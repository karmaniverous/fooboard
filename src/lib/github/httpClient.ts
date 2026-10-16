/**
 * The GitHub HTTP core (spec.md §5, C-16): one GET helper that wires
 * together the ETag cache, the per-credential serial queue, rate-limit
 * budget tracking, token-expiry tracking and typed-error mapping. Every
 * adapter method in `reader.ts` goes through `GitHubHttpClient.getJson`.
 *
 * @module
 */
import { SerialQueue } from '@/lib/queue/serialQueue';

import {
  GitHubAuthError,
  GitHubForbiddenError,
  GitHubHttpError,
  GitHubNetworkError,
  GitHubNotFoundError,
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
  lowBudgetThreshold?: number;
}

/**
 * The shared HTTP core for one credential: serial queue, ETag cache, budget
 * and token-expiry tracking, typed-error mapping. Never includes the token
 * in a thrown error's message.
 */
export class GitHubHttpClient {
  private readonly token: string;
  private readonly fetchImpl: FetchLike;
  private readonly lowBudgetThreshold: number;
  private readonly cache = new EtagCache();
  private readonly queue = new SerialQueue();
  private budget: RateLimitBudget | undefined;
  private tokenExpiration: string | undefined;
  private lastRequestWasCached: boolean | undefined;

  constructor({
    token,
    fetchImpl,
    lowBudgetThreshold,
  }: GitHubHttpClientConfig) {
    this.token = token;
    this.fetchImpl = fetchImpl ?? ((url, init) => fetch(url, init));
    this.lowBudgetThreshold = lowBudgetThreshold ?? 0.1;
  }

  /** Current rate-limit budget, or `undefined` before the first response. */
  getBudget(): RateLimitBudget | undefined {
    return this.budget;
  }

  /** The `github-authentication-token-expiration` header's last value, if GitHub sent one. */
  getTokenExpiration(): string | undefined {
    return this.tokenExpiration;
  }

  /** Whether the most recent `getJson` call returned a `304` cache hit
   * (spec.md §6 spike 2: a dev aid confirms this manually). `undefined`
   * before the first request. */
  wasLastRequestCached(): boolean | undefined {
    return this.lastRequestWasCached;
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
      this.lastRequestWasCached = true;
      return { data: cached.data, headers: res.headers };
    }
    this.lastRequestWasCached = false;
    if (res.status === 401) throw new GitHubAuthError(path);
    if (res.status === 404) throw new GitHubNotFoundError(path);
    if (res.status === 403 || res.status === 429) {
      if (isRateLimitResponse(res.status, res.headers)) {
        const retryAt = computeRetryAt(res.headers);
        this.queue.pauseUntil(retryAt);
        throw new RateLimitedError(path, retryAt);
      }
      throw new GitHubForbiddenError(path);
    }
    if (!res.ok) throw new GitHubHttpError(path, res.status);

    const text = await res.text();
    const data: unknown = text.length > 0 ? JSON.parse(text) : undefined;
    const etag = res.headers.get('etag');
    if (etag) this.cache.set(path, { etag, data });
    return { data, headers: res.headers };
  }

  private recordBudget(headers: Headers): void {
    const budget = parseRateLimitHeaders(headers, this.lowBudgetThreshold);
    if (budget) this.budget = budget;
  }

  private recordTokenExpiration(headers: Headers): void {
    const value = headers.get(TOKEN_EXPIRATION_HEADER);
    if (value) this.tokenExpiration = value;
  }
}
