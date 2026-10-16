/**
 * Typed Amplify errors (spec.md §4.3.5, §8 step 5). The AWS SDK throws
 * service exceptions identified by `name`; this module maps the ones the
 * board reacts to: a missing app (shown as an error cell), bad or expired
 * credentials (shown as *needs credential*), and throttling (the queue
 * pauses and retries later). Credentials never appear in messages: the SDK
 * doesn't include them, and these wrappers add only the operation name.
 *
 * @module
 */

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

/** Default wait after throttling when AWS gives no hint. */
const DEFAULT_THROTTLE_MS = 5_000;

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
    return new AmplifyThrottledError(message, operation, DEFAULT_THROTTLE_MS);
  }
  return err;
}
