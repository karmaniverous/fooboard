/**
 * Typed errors for the GitHub adapter (spec.md Â§5, C-5, C-16): distinct
 * classes for the HTTP outcomes callers need to branch on (expired/bad
 * credential, rate limiting, not found, network failure, bad payload).
 * Messages never include the token; only the request path and status are
 * included.
 *
 * @module
 */

/** Base class for all typed GitHub adapter errors. */
export abstract class GitHubReaderError extends Error {
  readonly path: string;

  constructor(message: string, path: string) {
    super(message);
    this.name = new.target.name;
    this.path = path;
  }
}

/** 401: the credential is missing, bad or expired. Maps to "needs credential". */
export class GitHubAuthError extends GitHubReaderError {
  constructor(path: string) {
    super(
      `GitHub request to ${path} failed: credential is missing or expired (401)`,
      path,
    );
  }
}

/** 403 that is not a rate-limit response (e.g. insufficient PAT scope). */
export class GitHubForbiddenError extends GitHubReaderError {
  constructor(path: string) {
    super(`GitHub request to ${path} failed: forbidden (403)`, path);
  }
}

/** 404: repo, run, branch or ref not found (or not visible to this token). */
export class GitHubNotFoundError extends GitHubReaderError {
  constructor(path: string) {
    super(`GitHub request to ${path} failed: not found (404)`, path);
  }
}

/** The request could not be sent or the response could not be read. */
export class GitHubNetworkError extends GitHubReaderError {
  constructor(path: string, cause?: unknown) {
    super(`GitHub request to ${path} failed: network error`, path);
    if (cause !== undefined) this.cause = cause;
  }
}

/** Primary or secondary rate limit hit; `retryAt` is a unix-ms timestamp. */
export class RateLimitedError extends GitHubReaderError {
  readonly retryAt: number;

  constructor(path: string, retryAt: number) {
    super(
      `GitHub request to ${path} was rate limited; retry after ${new Date(
        retryAt,
      ).toISOString()}`,
      path,
    );
    this.retryAt = retryAt;
  }
}

/** The response body did not match the expected schema. */
export class GitHubValidationError extends GitHubReaderError {
  constructor(path: string, issues: string) {
    super(`GitHub response from ${path} failed validation: ${issues}`, path);
  }
}

/** An HTTP status this adapter does not special-case (not 401/403/404/429). */
export class GitHubHttpError extends GitHubReaderError {
  readonly status: number;

  constructor(path: string, status: number) {
    super(
      `GitHub request to ${path} failed with status ${String(status)}`,
      path,
    );
    this.status = status;
  }
}

/** True for errors that mean the credential needs attention (401). */
export function isNeedsCredential(err: unknown): err is GitHubAuthError {
  return err instanceof GitHubAuthError;
}
