/**
 * Error display helpers: turn any thrown value into text for the user.
 * Editors and alerts keep the error's name (AWS SDK errors name the
 * problem, e.g. `NotFoundException`); board cells show only the message,
 * as the README describes (Decision 46 item 1).
 *
 * @module
 */

/** Describe an unknown thrown value as `Name: message`, or its string form. */
export function describeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

/** An unknown thrown value's message alone (its name when it has no
 * message), or its string form. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message || err.name;
  return String(err);
}
