/**
 * Staleness for one row (spec.md §3, §4.3.5): for each stage with a source
 * stage, resolve the cell's branch and the source cell's branch, compare
 * them (cell...source, so `aheadBy` counts source commits the cell lacks)
 * and derive the behind/diverged badge with commit subjects both ways.
 * Compares repeat each refresh; the ETag cache makes unchanged ones free.
 *
 * @module
 */
import { objectify } from 'radash';

import type { Stage } from '@/domain/config/stage';
import {
  type AmplifyCellDerivation,
  deriveStalenessBadge,
  type GithubCellDerivation,
  resolveStalenessBranch,
  type StalenessBadge,
} from '@/domain/derivation';
import { matchesBranchPattern } from '@/domain/matching/branchPattern';
import type { CompareResult } from '@/lib/github';

import type { DatedBranch } from './githubRow';
import type { CompareDetail } from './types';

/** A cell's badge and the compare behind it, if any. */
export interface CellStaleness {
  badge: StalenessBadge;
  compare?: CompareDetail;
}

/** The branch a cell is judged by: its run's, else the confirmed fallback. */
function cellBranch(
  stage: Stage,
  derivation: GithubCellDerivation | AmplifyCellDerivation | undefined,
  branches: readonly DatedBranch[],
): string | undefined {
  const runBranch =
    derivation?.kind === 'ok' ? derivation.branch : derivation?.branch;
  return resolveStalenessBranch({
    runBranch,
    pattern: stage.branchPattern,
    literalBranchExists: branches.some((b) => b.name === stage.branchPattern),
    matchingBranches: branches.filter((b) =>
      matchesBranchPattern(stage.branchPattern, b.name),
    ),
  });
}

/** Compute every stage's staleness for one row. */
export async function rowStaleness(
  stages: readonly Stage[],
  cells: Readonly<
    Record<string, GithubCellDerivation | AmplifyCellDerivation | undefined>
  >,
  branches: readonly DatedBranch[],
  compare: (base: string, head: string) => Promise<CompareResult>,
): Promise<Record<string, CellStaleness>> {
  const branchOf = objectify(
    stages,
    (s) => s.id,
    (s) => cellBranch(s, cells[s.id], branches),
  );
  const result: Record<string, CellStaleness> = {};

  for (const stage of stages) {
    const own = branchOf[stage.id];
    const source = stage.sourceStageId
      ? branchOf[stage.sourceStageId]
      : undefined;
    if (!own || !source || own === source) {
      result[stage.id] = { badge: undefined };
      continue;
    }
    const counts = await compare(own, source);
    result[stage.id] = {
      badge: deriveStalenessBadge({
        cellBranch: own,
        sourceBranch: source,
        compare: counts,
      }),
      compare: {
        sourceBranch: source,
        htmlUrl: counts.htmlUrl,
        behindSubjects: counts.aheadCommitSubjects,
        aheadSubjects: counts.behindCommitSubjects,
      },
    };
  }
  return result;
}
