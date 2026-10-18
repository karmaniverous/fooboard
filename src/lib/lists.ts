/**
 * Small immutable list edits shared by the editors. Pure.
 *
 * @module
 */

/** Move item `index` of `list` by `by` places (clamped). */
export function move<T>(list: readonly T[], index: number, by: number): T[] {
  const to = Math.max(0, Math.min(list.length - 1, index + by));
  const next = [...list];
  const [item] = next.splice(index, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

/** `list` with item `index` changed by `change`. */
export const patchAt = <T extends object>(
  list: readonly T[],
  index: number,
  change: Partial<T>,
): T[] => list.map((item, i) => (i === index ? { ...item, ...change } : item));
