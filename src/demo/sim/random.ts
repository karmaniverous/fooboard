/**
 * The simulator's seeded randomness (spec.md §3.14 *Engine*): a small,
 * fast generator (mulberry32) seeded from the scenario's seed and a
 * stream name, so each repo, branch, run and app draws from its own
 * stream. Adding a repo to a scenario therefore leaves every other
 * repo's timeline unchanged, and the same seed always gives the same
 * world. Pure.
 *
 * @module
 */

/** A source of numbers in [0, 1). */
export type Random = () => number;

/** FNV-1a's 32-bit offset basis and prime. */
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** A 32-bit hash of `text` (FNV-1a): stable, unsigned. */
export function hash32(text: string): number {
  let h = FNV_OFFSET;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME);
  }
  return h >>> 0;
}

/** mulberry32's increment and output mixing constants. */
const MULBERRY_INCREMENT = 0x6d2b79f5;
const MIX_A = 15;
const MIX_B = 7;
const MIX_C = 61;
const MIX_D = 14;
/** 2^32, to scale a 32-bit integer into [0, 1). */
const UINT32_RANGE = 4294967296;

/** A generator for stream `stream` of `seed`. */
export function seededRandom(seed: number, stream: string): Random {
  let state = hash32(`${String(seed)}:${stream}`);
  return () => {
    state = (state + MULBERRY_INCREMENT) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> MIX_A), t | 1);
    t ^= t + Math.imul(t ^ (t >>> MIX_B), t | MIX_C);
    return ((t ^ (t >>> MIX_D)) >>> 0) / UINT32_RANGE;
  };
}

/** A whole number of milliseconds within `[min, max]`. */
export const between = (
  random: Random,
  [min, max]: readonly [number, number],
): number => Math.round(min + random() * (max - min));

/** One of `items`, chosen by `random` (the list must not be empty). */
export const pick = <T>(random: Random, items: readonly [T, ...T[]]): T =>
  items[Math.floor(random() * items.length)];
