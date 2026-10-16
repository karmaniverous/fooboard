/**
 * Error display helper: turn any thrown value into a message suitable for
 * showing verbatim to the user (AWS SDK errors keep their name, e.g.
 * `NotFoundException`).
 *
 * @module
 */

/** Describe an unknown thrown value as `Name: message`, or its string form. */
export function describeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}
