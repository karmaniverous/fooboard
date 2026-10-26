/**
 * The GitHub HTTP core (spec.md §3.1, Decision 5): one conditional GET
 * that sends `If-None-Match` with the ETag the caller kept (the query
 * layer stores it with the cached data), reports the token's budget from
 * every response's rate-limit headers and maps failures to typed
 * errors. It holds no queue and no cache: requests in
 * flight are the query layer's limiter's business (§3.2).
 *
 * @module
 */
import { describeError } from '@/lib/errors';

import {
  GitHubAuthError,
  GitHubForbiddenError,
  GitHubHttpError,
  GitHubNetworkError,
  GitHubNotFoundError,
  GitHubValidationError,
  RateLimitedError,
} from './errors';
import {
  computeRetryAt,
  isRateLimitResponse,
  parseRateLimitHeaders,
  type RateLimitBudget,
} from './rateLimit';
import { HTTP_STATUS } from './status';

/** A `fetch`-compatible function, injectable for tests (spec.md: no real network in tests). */
export type FetchLike = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<Response>;

/** GitHub's message for a secondary rate limit. */
const SECONDARY_LIMIT = /secondary rate limit/i;

/** A response with a body: the parsed JSON, its ETag and `Link` header,
 * and whether `fetch` followed a redirect to reach it (a renamed repo,
 * Decision 26). */
export interface JsonResponse {
  notModified: false;
  data: unknown;
  etag: string | null;
  link: string | null;
  redirected: boolean;
}

/** A `304 Not Modified`: the caller's cached data still holds. */
export interface NotModifiedResponse {
  notModified: true;
}

/** Config for a `GitHubHttpClient`. */
export interface GitHubHttpClientConfig {
  token: string;
  fetchImpl?: FetchLike;
  /** Called with the budget every response reports (Decision 6). */
  onBudget?: (budget: RateLimitBudget) => void;
}

/**
 * The HTTP core for one credential. Never includes the token in a thrown
 * error's message.
 */
export class GitHubHttpClient {
  private readonly token: string;
  private readonly fetchImpl: FetchLike;
  private readonly onBudget: (budget: RateLimitBudget) => void;

  constructor({ token, fetchImpl, onBudget }: GitHubHttpClientConfig) {
    this.token = token;
    this.fetchImpl = fetchImpl ?? ((url, init) => fetch(url, init));
    this.onBudget = onBudget ?? (() => undefined);
  }

  /** GET `path`, conditional on `etag` when given. */
  async get(
    path: string,
    etag?: string | null,
  ): Promise<JsonResponse | NotModifiedResponse> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    };
    if (etag) headers['If-None-Match'] = etag;

    let res: Response;
    try {
      res = await this.fetchImpl(path, { headers });
    } catch (cause) {
      throw new GitHubNetworkError(path, cause);
    }

    const budget = parseRateLimitHeaders(res.headers);
    if (budget) this.onBudget(budget);

    if (res.status === HTTP_STATUS.notModified && etag)
      return { notModified: true };
    if (res.status === HTTP_STATUS.unauthorized)
      throw new GitHubAuthError(path);
    if (res.status === HTTP_STATUS.notFound)
      throw new GitHubNotFoundError(path);

    const text = await this.readBody(res, path);
    if (
      res.status === HTTP_STATUS.forbidden ||
      res.status === HTTP_STATUS.tooManyRequests
    ) {
      // Secondary limits can arrive as a plain 403 whose only signal is
      // the error message.
      if (
        isRateLimitResponse(res.status, res.headers) ||
        SECONDARY_LIMIT.test(text)
      ) {
        throw new RateLimitedError(path, computeRetryAt(res.headers));
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
    return {
      notModified: false,
      data,
      etag: res.headers.get('etag'),
      link: res.headers.get('link'),
      redirected: res.redirected,
    };
  }

  /** Read the body, mapping a failed read to a network error. */
  private async readBody(res: Response, path: string): Promise<string> {
    try {
      return await res.text();
    } catch (cause) {
      throw new GitHubNetworkError(path, cause);
    }
  }
}
