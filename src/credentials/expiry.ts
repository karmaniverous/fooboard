/**
 * Token expiry warnings (spec.md C-5): GitHub reports a fine-grained
 * token's expiry in a response header; the app warns as it approaches.
 * Pure.
 *
 * @module
 */

/** Warn this many days before a token expires. */
const EXPIRY_WARNING_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A warning for a token expiring at `expiresAt` (as GitHub reports it,
 * e.g. `2026-12-01 00:00:00 UTC`), or undefined when it is not close.
 */
export function expiryWarning(
  expiresAt: string | undefined,
  now: number,
): string | undefined {
  if (!expiresAt) return undefined;
  const at = Date.parse(expiresAt.replace(' UTC', 'Z').replace(' ', 'T'));
  if (Number.isNaN(at)) return undefined;
  const days = Math.ceil((at - now) / DAY_MS);
  if (days > EXPIRY_WARNING_DAYS) return undefined;
  if (days <= 0) return 'Expired';
  return days === 1 ? 'Expires tomorrow' : `Expires in ${String(days)} days`;
}
