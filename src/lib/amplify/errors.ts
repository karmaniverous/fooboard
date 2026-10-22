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
    this.name = new.target.name;
    this.operation = operation;
  }
}

/** The app (or branch/job) doesn't exist for this credential and region. */
export class AmplifyNotFoundError extends AmplifyReaderError {}

/** The credential was rejected: missing, wrong, expired or not permitted. */
export class AmplifyAuthError extends AmplifyReaderError {}

/** AWS throttled the request; retry after `retryAfterMs`. */
export class AmplifyThrottledError extends AmplifyReaderError {
  readonly retryAfterMs: number;

  constructor(message: string, operation: string, retryAfterMs: number) {
    super(message, operation);
    this.retryAfterMs = retryAfterMs;
  }
}

const AUTH_ERRORS = new Set([
  'UnauthorizedException',
  'UnrecognizedClientException',
  'InvalidSignatureException',
  'ExpiredTokenException',
  'AccessDeniedException',
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

/** Map an AWS SDK error to a typed Amplify error; other values pass through. */
export function toAmplifyError(err: unknown, operation: string): unknown {
  if (!(err instanceof Error)) return err;
  const message = `${operation}: ${err.name}: ${err.message}`;
  if (err.name === 'NotFoundException') {
    return new AmplifyNotFoundError(message, operation);
  }
  if (AUTH_ERRORS.has(err.name))
    return new AmplifyAuthError(message, operation);
  if (THROTTLE_ERRORS.has(err.name)) {
    return new AmplifyThrottledError(message, operation, throttleDelayMs(err));
  }
  return err;
}
