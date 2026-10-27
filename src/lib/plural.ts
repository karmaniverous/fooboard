/**
 * Counted words in the app's English: one shared helper, so a count and
 * its noun always agree ("1 commit", "2 commits", "0 commits"). Pure.
 *
 * @module
 */

/** `n` and the word for that many: `one` for exactly 1, else `many`. */
export const plural = (n: number, one: string, many: string): string =>
  `${String(n)} ${n === 1 ? one : many}`;
