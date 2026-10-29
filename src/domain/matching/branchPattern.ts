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
