/**
 * Branch pattern matching (spec.md §3, §4.3.5): a literal branch (`main`)
 * or a glob (`release/**`, `preview/*`), where `*` matches within one path
 * segment and `**` matches across segments. Pure; no network.
 *
 * @module
 */

/** Is this pattern a literal branch name (no wildcard segments)? */
export function isLiteralPattern(pattern: string): boolean {
  return !pattern.includes('*');
}

function escapeRegExp(segment: string): string {
  return segment.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

/** Compile a branch pattern to an anchored regular expression. */
function patternToRegExp(pattern: string): RegExp {
  // Split on `**` first so it can match across `/`, then expand `*` within
  // the remaining literal pieces to match within one segment.
  // `**` requires at least one character (a real branch segment), so
  // `release/**` matches `release/24.3` but not the bare `release/`.
  const doubleStarParts = pattern.split('**');
  const source = doubleStarParts
    .map((part) => part.split('*').map(escapeRegExp).join('[^/]*'))
    .join('.+');
  return new RegExp(`^${source}$`);
}

/** Does `branch` match `pattern` (spec.md §3: `*` within a segment, `**`
 * across segments)? */
export function matchesBranchPattern(pattern: string, branch: string): boolean {
  if (isLiteralPattern(pattern)) return pattern === branch;
  return patternToRegExp(pattern).test(branch);
}

/**
 * The literal prefix of a branch pattern, for the
 * `git/matching-refs/heads/{prefix}` lookup (spec.md §4.3.5): the complete
 * path segments before the first wildcard. A literal pattern's prefix is
 * the whole pattern.
 */
export function branchPatternPrefix(pattern: string): string {
  const starIndex = pattern.indexOf('*');
  if (starIndex === -1) return pattern;
  const beforeStar = pattern.slice(0, starIndex);
  const lastSlash = beforeStar.lastIndexOf('/');
  return lastSlash === -1 ? '' : beforeStar.slice(0, lastSlash + 1);
}
