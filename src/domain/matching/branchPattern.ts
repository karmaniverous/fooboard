/**
 * Branch pattern matching (spec.md A§3, A§4.3.5): a literal branch (`main`)
 * or a glob (`release/**`, `preview/*`), where `*` matches one or more
 * characters within one path segment and `**` one or more across segments
 * (the same regex as the stage rules the patterns write, spec.md
 * A§4.3.7). Pure; no network.
 *
 * @module
 */
import { branchRegex, STAR } from '@/domain/rules/branch';

/** Is this pattern a literal branch name (no wildcard segments)? */
export function isLiteralPattern(pattern: string): boolean {
  return !pattern.includes(STAR);
}

/** Does `branch` match `pattern` (spec.md A§3: `*` within a segment, `**`
 * across segments)? */
export function matchesBranchPattern(pattern: string, branch: string): boolean {
  if (isLiteralPattern(pattern)) return pattern === branch;
  return new RegExp(branchRegex(pattern)).test(branch);
}

/**
 * The literal prefix of a branch pattern, for the
 * `git/matching-refs/heads/{prefix}` lookup (spec.md A§4.3.5): the complete
 * path segments before the first wildcard. A literal pattern's prefix is
 * the whole pattern.
 */
export function branchPatternPrefix(pattern: string): string {
  const starIndex = pattern.indexOf(STAR);
  if (starIndex === -1) return pattern;
  const beforeStar = pattern.slice(0, starIndex);
  const lastSlash = beforeStar.lastIndexOf('/');
  return lastSlash === -1 ? '' : beforeStar.slice(0, lastSlash + 1);
}
