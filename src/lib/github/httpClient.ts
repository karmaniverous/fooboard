/**
 * The GitHub HTTP core (spec.md §5, C-16): one GET helper that wires
 * together the ETag cache, the per-credential serial queue, rate-limit
 * budget tracking, token-expiry tracking and typed-error mapping. Every
 * adapter method in `reader.ts` goes through `GitHubHttpClient.getJson`.
 *
 * @module
 */
import { describeError } from '@/lib/errors';
import { SerialQueue } from '@/lib/queue/serialQueue';

import {
  GitHubAuthError,
  GitHubForbiddenError,
  GitHubHttpError,
  GitHubNetworkError,
  GitHubNotFoundError,
  GitHubValidationError,
  RateLimitedError,
} from './errors';
import { EtagCache } from './etagCache';
import {
  computeRetryAt,
  isRateLimitResponse,
  parseRateLimitHeaders,
  type RateLimitBudget,
} from './rateLimit';

/** A `fetch`-compatible function, injectable for tests (spec.md: no real network in tests). */
export type FetchLike = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<Response>;

/** GitHub's message for a secondary rate limit. */
const SECONDARY_LIMIT = /secondary rate limit/i;

const TOKEN_EXPIRATION_HEADER = 'github-authentication-token-expiration';

/** One GET response: the parsed JSON body plus the raw headers (for pagination). */
export interface JsonResponse {
  data: unknown;
  headers: Headers;
}

/** Config for a `GitHubHttpClient`: the token and the fraction that triggers a `'low'` budget. */
export interface GitHubHttpClientConfig {
  token: string;
  fetchImpl?: FetchLike;
}

/**
 * The shared HTTP core for one credential: serial queue, ETag cache, budget
 * and token-expiry tracking, typed-error mapping. Never includes the token
 * in a thrown error's message.
 */
export class GitHubHttpClient {
  private readonly token: string;
  private readonly fetchImpl: FetchLike;
  private readonly cache = new EtagCache();
  private readonly queue = new SerialQueue();
  private budget: RateLimitBudget | undefined;
  private tokenExpiration: string | undefined;

  constructor({ token, fetchImpl }: GitHubHttpClientConfig) {
    this.token = token;
    this.fetchImpl = fetchImpl ?? ((url, init) => fetch(url, init));
  }

  /** The latest rate-limit budget seen, if any response carried one. */
  getBudget(): RateLimitBudget | undefined {
    return this.budget;
  }

  /** Record a budget read from the `rate_limit` endpoint's body. */
  noteBudget(budget: RateLimitBudget): void {
    this.budget = budget;
  }

  /** The token's expiry (`github-authentication-token-expiration`), if sent. */
  getTokenExpiration(): string | undefined {
    return this.tokenExpiration;
  }

  /** GET `path`, returning the parsed JSON body and headers; queued and cached per credential. */
  getJson(path: string): Promise<JsonResponse> {
    return this.queue.enqueue(() => this.fetchOnce(path));
  }

  private async fetchOnce(path: string): Promise<JsonResponse> {
    const cached = this.cache.get(path);
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (cached) headers['If-None-Match'] = cached.etag;

    let res: Response;
    try {
      res = await this.fetchImpl(path, { headers });
    } catch (cause) {
      throw new GitHubNetworkError(path, cause);
    }

    this.recordBudget(res.headers);
    this.recordTokenExpiration(res.headers);

    if (res.status === 304 && cached) {
      // A 304 may omit `Link`; restore it so pagination continues.
      const headers = new Headers(res.headers);
      if (cached.link && !headers.has('link')) headers.set('link', cached.link);
      return { data: cached.data, headers };
    }
    if (res.status === 401) throw new GitHubAuthError(path);
    if (res.status === 404) throw new GitHubNotFoundError(path);

    const text = await this.readBody(res, path);
    if (res.status === 403 || res.status === 429) {
      // Secondary limits can arrive as a plain 403 whose only signal is
      // the error message.
      if (
        isRateLimitResponse(res.status, res.headers) ||
        SECONDARY_LIMIT.test(text)
      ) {
        const retryAt = computeRetryAt(res.headers);
        this.queue.pauseUntil(retryAt);
        throw new RateLimitedError(path, retryAt);
      }
      throw new GitHubForbiddenError(path);
    }
    if (!res.ok) throw new GitHubHttpError(path, res.status);

    let data: unknown;
    try {
      data = text.length > 0 ? JSON.parse(text) : undefined;
    } catch (err) {
      throw new GitHubValidationError(
        path,
        `invalid JSON: ${describeError(err)}`,
      );
    }
    const etag = res.headers.get('etag');
    const link = res.headers.get('link');
    if (etag) this.cache.set(path, { etag, data, link });
    return { data, headers: res.headers };
  }

  /** Read the body, mapping a failed read to a network error. */
  private async readBody(res: Response, path: string): Promise<string> {
    try {
      return await res.text();
    } catch (cause) {
      throw new GitHubNetworkError(path, cause);
    }
  }

  private recordBudget(headers: Headers): void {
    const budget = parseRateLimitHeaders(headers);
    if (budget) this.budget = budget;
  }

  private recordTokenExpiration(headers: Headers): void {
    const value = headers.get(TOKEN_EXPIRATION_HEADER);
    if (value) this.tokenExpiration = value;
  }
}
