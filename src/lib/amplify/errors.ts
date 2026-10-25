/**
 * Typed Amplify errors (spec.md §4.3.5, §8 step 5). The AWS SDK throws
 * service exceptions identified by `name`; this module maps the ones the
 * board reacts to: a missing app (shown as an error cell), bad or expired
 * credentials (shown as *needs credential*), and throttling (the
 * credential's limiter pauses for AWS's suggested delay, Decision 21).
 * Credentials never appear in messages: the SDK
 * doesn't include them, and these wrappers add only the operation name.
 *
 * @module
 */

import { secondsToMs } from '@/lib/retryAfter';

/** Base class for the errors this adapter raises. */
class AmplifyReaderError extends Error {
  readonly operation: string;

  constructor(message: string, operation: string) {
    super(message);
    this.operation = operation;
  }
}

/** The app (or branch/job) doesn't exist for this credential and region. */
export class AmplifyNotFoundError extends AmplifyReaderError {
  /** Literal, so it survives minification (the board shows it). */
  override readonly name = 'AmplifyNotFoundError';
}

/** The credential was rejected: missing, wrong, expired or not permitted.
 * `accessDenied`: AWS answered `AccessDeniedException`, which in the app
 * search means an AWS organisation's policy blocks the region (spec.md
 * §3.12). */
export class AmplifyAuthError extends AmplifyReaderError {
  /** Literal, so it survives minification (the board shows it). */
  override readonly name = 'AmplifyAuthError';

  readonly accessDenied: boolean;

  constructor(message: string, operation: string, accessDenied = false) {
    super(message, operation);
    this.accessDenied = accessDenied;
  }
}

/** AWS throttled the request; retry after `retryAfterMs`. */
export class AmplifyThrottledError extends AmplifyReaderError {
  /** Literal, so it survives minification (the board shows it). */
  override readonly name = 'AmplifyThrottledError';

  readonly retryAfterMs: number;

  constructor(message: string, operation: string, retryAfterMs: number) {
    super(message, operation);
    this.retryAfterMs = retryAfterMs;
  }
}

/** AWS's answer when a policy denies the call. */
const ACCESS_DENIED = 'AccessDeniedException';

const AUTH_ERRORS = new Set([
  'UnauthorizedException',
  'UnrecognizedClientException',
  'InvalidSignatureException',
  'ExpiredTokenException',
  ACCESS_DENIED,
  'InvalidClientTokenId',
]);

const THROTTLE_ERRORS = new Set([
  'TooManyRequestsException',
  'ThrottlingException',
]);

/** Default wait after throttling when AWS gives no hint (Decision 21). */
export const DEFAULT_THROTTLE_MS = 5_000;

/** The header carrying AWS's suggested delay, in seconds. */
const RETRY_AFTER = 'retry-after';

/** The delay AWS suggests for a throttled call: the response's
 * `Retry-After` (seconds), when the SDK error carries the raw response
 * and the browser exposes the header, else `DEFAULT_THROTTLE_MS`. The
 * SDK's own retry information (`$retryable`) carries no delay, and on
 * 2026-10-22 Amplify's CORS exposed only `x-amzn-RequestId` and
 * `x-amzn-ErrorType` to scripts, so in browsers this is the 5 s
 * fallback until AWS exposes the header. */
function throttleDelayMs(err: Error): number {
  const response: unknown = Reflect.get(err, '$response');
  const headers: unknown =
    typeof response === 'object' && response !== null
      ? Reflect.get(response, 'headers')
      : undefined;
  const raw: unknown =
    typeof headers === 'object' && headers !== null
      ? Reflect.get(headers, RETRY_AFTER)
      : undefined;
  return secondsToMs(raw) ?? DEFAULT_THROTTLE_MS;
}

/** Did the request get no HTTP response at all? The browser's `fetch`
 * rejects with a `TypeError` when it is offline, can't reach the host,
 * or CORS hides the response; the SDK passes it through unmapped. */
export const isNetworkFailure = (err: unknown): boolean =>
  err instanceof TypeError;

/** The HTTP status `err` carries in `field` under `key`, if a number. */
const statusIn = (err: Error, field: string, key: string): number => {
  const holder: unknown = Reflect.get(err, field);
  const status: unknown =
    typeof holder === 'object' && holder !== null
      ? Reflect.get(holder, key)
      : undefined;
  return typeof status === 'number' ? status : 0;
};

/** The HTTP status of the answer `err` came from (its raw `$response`
 * or its `$metadata`), or 0 when it carries none. */
const answerStatus = (err: Error): number =>
  Math.max(
    statusIn(err, '$response', 'statusCode'),
    statusIn(err, '$metadata', 'httpStatusCode'),
  );

/** The least HTTP status a server error has. */
const SERVER_ERROR_STATUS = 500;

/** An AWS SDK error the server is to blame for: `$fault: 'server'`, or a
 * 5xx answer the SDK couldn't parse (a gateway timeout's HTML page throws
 * a deserialization error carrying the raw `$response`, Q32). */
export const isServerFault = (err: unknown): boolean =>
  err instanceof Error &&
  (Reflect.get(err, '$fault') === 'server' ||
    answerStatus(err) >= SERVER_ERROR_STATUS);

/** The HTTP statuses of a rejected request. */
const REJECTED_STATUSES: ReadonlySet<number> = new Set([401, 403]);

/** Did AWS reject the request (401 or 403), whatever error the SDK made
 * of it? In a browser, an opt-in region the account hasn't enabled
 * answers 403 without an error type the SDK can read, so the SDK throws
 * `Unknown` (the real board's check of 2026-10-25). */
export const isRejectedAnswer = (err: unknown): boolean =>
  err instanceof Error && REJECTED_STATUSES.has(answerStatus(err));

/** Map an AWS SDK error to a typed Amplify error; other values pass through. */
export function toAmplifyError(err: unknown, operation: string): unknown {
  if (!(err instanceof Error)) return err;
  const message = `${operation}: ${err.name}: ${err.message}`;
  if (err.name === 'NotFoundException') {
    return new AmplifyNotFoundError(message, operation);
  }
  if (AUTH_ERRORS.has(err.name))
    return new AmplifyAuthError(message, operation, err.name === ACCESS_DENIED);
  if (THROTTLE_ERRORS.has(err.name)) {
    return new AmplifyThrottledError(message, operation, throttleDelayMs(err));
  }
  return err;
}
