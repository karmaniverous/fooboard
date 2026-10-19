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
  type CellDerivation,
  deriveStalenessBadge,
  type StalenessBadge,
} from '@/domain/derivation';
import {
  type CompareResult,
  type GitHubReader,
  RateLimitedError,
} from '@/lib/github';

import { repoRef } from './githubRow';
import type { CompareDetail } from './types';

/** A cell's badge and the compare behind it, if any. */
export interface CellStaleness {
  badge: StalenessBadge;
  compare?: CompareDetail;
}

/** The branch a cell is judged by: its run's, else the confirmed fallback. */
function cellBranch(
  derivation: CellDerivation | undefined,
): string | undefined {
  return derivation?.kind === 'ok' ? derivation.branch : undefined;
}

/** Compute every stage's staleness for one row. */
export async function rowStaleness(
  stages: readonly Stage[],
  cells: Readonly<Record<string, CellDerivation | undefined>>,
  compare: (base: string, head: string) => Promise<CompareResult>,
): Promise<Record<string, CellStaleness>> {
  const branchOf = objectify(
    stages,
    (s) => s.id,
    (s) => cellBranch(cells[s.id]),
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
    let counts: CompareResult;
    try {
      counts = await compare(own, source);
    } catch (err) {
      // One failed compare unbadges only its cell; once rate limited, the
      // rest wait for the next poll, keeping the badges already computed.
      result[stage.id] = { badge: undefined };
      if (err instanceof RateLimitedError) break;
      continue;
    }
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

/** One compare per branch pair within a refresh, shared by its rows. */
export function compareOnce(
  reader: GitHubReader,
  repo: string,
): (base: string, head: string) => Promise<CompareResult> {
  const seen = new Map<string, Promise<CompareResult>>();
  return (base, head) => {
    const key = `${base}...${head}`;
    let pending = seen.get(key);
    if (!pending) {
      pending = reader.compare(repoRef(repo), base, head);
      seen.set(key, pending);
    }
    return pending;
  };
}

/** Staleness for one row from its cells, reading the repo's branches when
 * the refresh didn't list them. Badges are best-effort: any failure leaves
 * the row without badges. */
export async function readStaleness(
  stages: readonly Stage[],
  reader: GitHubReader | undefined,
  cells: Record<string, { derivation: CellDerivation }>,
  compare: (base: string, head: string) => Promise<CompareResult>,
): Promise<Record<string, CellStaleness>> {
  if (!reader) return {};
  try {
    const derivations = Object.fromEntries(
      Object.entries(cells).map(([id, c]) => [id, c.derivation]),
    );
    return await rowStaleness(stages, derivations, compare);
  } catch {
    return {};
  }
}
