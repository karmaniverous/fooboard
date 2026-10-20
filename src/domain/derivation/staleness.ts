/**
 * Staleness: behind/diverged badges from GitHub compare counts, and the
 * confirmed staleness-branch fallback (spec.md §3, §4.3.5). Comparisons are
 * made between branch names, not commit hashes; this module only turns
 * already-fetched compare counts and branch candidates into a badge. Pure;
 * no network.
 *
 * @module
 */
/** `ahead_by`/`behind_by` from `GET compare/{cellBranch}...{sourceBranch}`
 * (spec.md §3). */
export interface CompareCounts {
  aheadBy: number;
  behindBy: number;
}

export type StalenessBadge =
  | { kind: 'behind'; count: number }
  | { kind: 'diverged'; behind: number; ahead: number }
  | undefined;

/**
 * Compute the staleness badge from compare counts (spec.md §3): `aheadBy`
 * is how many commits the source has that the cell lacks (the cell is
 * "behind" by that many); `behindBy` is how many commits the cell has that
 * the source lacks (the cell's own divergent commits). Diverged when both
 * are positive; the badge shows `behind/ahead`.
 */
export function computeStaleness(
  compare: CompareCounts | undefined,
): StalenessBadge {
  if (!compare) return undefined;
  const { aheadBy: behindCount, behindBy: aheadCount } = compare;
  if (behindCount > 0 && aheadCount > 0) {
    return { kind: 'diverged', behind: behindCount, ahead: aheadCount };
  }
  if (behindCount > 0) return { kind: 'behind', count: behindCount };
  return undefined;
}
/**
 * No badge is shown if either side lacks a resolved branch (spec.md
 * §4.3.5). Combines branch resolution for both sides with the compare
 * count computation.
 */
export function deriveStalenessBadge(input: {
  cellBranch: string | undefined;
  sourceBranch: string | undefined;
  compare?: CompareCounts;
}): StalenessBadge {
  if (!input.cellBranch || !input.sourceBranch) return undefined;
  return computeStaleness(input.compare);
}
