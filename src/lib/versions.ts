/**
 * Semantic version order, and whether a build's version is one this
 * browser hasn't seen (spec 0.2.0 §3.D): the dot on *Release notes*.
 * Pure.
 *
 * @module
 */

const SEMVER =
  /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

/** The index of the prerelease group in `SEMVER`'s match. */
const PRERELEASE_GROUP = 4;

/** The number of numeric parts (major, minor, patch). */
const VERSION_PARTS = 3;

/** A match's group `i`, undefined when it took no part. */
const group = (m: RegExpMatchArray, i: number): string | undefined => m[i];

/** Compare two prerelease identifiers by semver's rules: numbers
 * numerically and below words, words by character. */
function compareIdentifier(a: string, b: string): number {
  const numeric = /^\d+$/;
  if (numeric.test(a) && numeric.test(b)) return Number(a) - Number(b);
  if (numeric.test(a)) return -1;
  if (numeric.test(b)) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Semver order of `a` and `b` (negative, zero or positive), or undefined
 * when either isn't a semantic version. */
export function compareVersions(a: string, b: string): number | undefined {
  const x = SEMVER.exec(a);
  const y = SEMVER.exec(b);
  if (!x || !y) return undefined;
  for (let i = 1; i <= VERSION_PARTS; i++) {
    const d = Number(x[i]) - Number(y[i]);
    if (d !== 0) return d;
  }
  // A release is above its prereleases.
  const [pa, pb] = [group(x, PRERELEASE_GROUP), group(y, PRERELEASE_GROUP)];
  if (pa === undefined || pb === undefined)
    return pa === pb ? 0 : pa === undefined ? 1 : -1;
  const [ia, ib] = [pa.split('.'), pb.split('.')];
  for (let i = 0; i < Math.min(ia.length, ib.length); i++) {
    const d = compareIdentifier(ia[i] ?? '', ib[i] ?? '');
    if (d !== 0) return d;
  }
  return ia.length - ib.length;
}

/** Whether `version` is one this browser hasn't seen: nothing was seen,
 * or what was seen is older (by semver; when either isn't a semantic
 * version, any difference counts). */
export function isUnseen(
  version: string,
  lastSeen: string | undefined,
): boolean {
  if (lastSeen === undefined) return true;
  const order = compareVersions(version, lastSeen);
  return order === undefined ? version !== lastSeen : order > 0;
}
