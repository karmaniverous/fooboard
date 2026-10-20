/**
 * Fresh ids: a base, or the base with the first free numeric suffix
 * (`base-2`, `base-3`...). Pure.
 *
 * @module
 */

/** The first suffix tried when the base is taken. */
export const FIRST_ID_SUFFIX = 2;

/** `base`, or `base-N` for the first N from {@link FIRST_ID_SUFFIX} that
 * `taken` lacks. */
export function freshId(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  let n = FIRST_ID_SUFFIX;
  while (used.has(`${base}-${String(n)}`)) n++;
  return `${base}-${String(n)}`;
}
