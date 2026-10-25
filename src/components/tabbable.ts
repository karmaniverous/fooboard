/**
 * The first control Tab reaches inside an element: where a panel, sheet or
 * popup puts focus when it opens (its first field), since Radix would
 * otherwise focus the first control in document order (the header's
 * *Close*).
 *
 * @module
 */

/** What Tab skips even with a tab index: disabled, hidden. */
const UNREACHABLE = ':disabled, input[type="hidden"], [hidden], [hidden] *';

/** The first element under `root` that Tab reaches, if any. */
export function firstTabbable(
  root: HTMLElement | null,
): HTMLElement | undefined {
  if (!root) return undefined;
  return [...root.querySelectorAll<HTMLElement>('*')].find(
    (el) => el.tabIndex >= 0 && !el.matches(UNREACHABLE),
  );
}
