/**
 * Staleness for one row from the cache (spec.md §3.1, §2.7): for each
 * stage with a source stage whose cells sit on different branches,
 * compare queries keyed by branch pair: `cell...source` (the counts, and
 * the commits the cell lacks) and, only when that says the cell has
 * commits its source lacks, `source...cell` (to list them). Compares poll at the idle interval and refetch when either
 * cell's commit changes. A failed compare drops its cached data and
 * unbadges its cell; a cell waiting for its compares is not settled.
 * Pure.
 *
 * @module
 */
import type { QueryClient } from '@tanstack/query-core';

import type { Stage } from '@/domain/config/stage';
import {
  type CellDerivation,
  deriveStalenessBadge,
  type StalenessBadge,
} from '@/domain/derivation';
import type { CompareApiResult } from '@/lib/github';
import { type GithubData, githubSnapshot, type Snapshot } from '@/query/cache';
import { isRateLimit } from '@/query/errors';
import { IDLE_INTERVAL_MS, pollEvery } from '@/query/intervals';
import { githubKey } from '@/query/keys';

import type { Need } from './need';
import type { CompareDetail } from './types';

/** The most commit subjects a compare lists each way. */
export const COMMIT_SUBJECTS_LISTED = 10;

/** A cell's badge and the compare behind it, if any. */
export interface CellStaleness {
  badge: StalenessBadge;
  compare?: CompareDetail;
  /** Its compares have answered (or failed): the badge is final. */
  settled: boolean;
}

/** Where a cell's compares go: its git link, with the token the cell
 * reads (spec.md §3.11). */
export interface GitLink {
  client: QueryClient;
  credentialId: string;
  repo: string;
  overBudget: boolean;
}

const UNBADGED: CellStaleness = { badge: undefined, settled: true };

/** The newest commit subjects of a compare (GitHub lists oldest first). */
const commitSubjects = (result: CompareApiResult): string[] =>
  result.commits
    .slice(-COMMIT_SUBJECTS_LISTED)
    .reverse()
    .map((c) => c.commit.message.split('\n')[0] ?? '');

/** A cell can carry a badge only when its record has both `commit` and
 * `branch` (spec.md §2.6 *Git link and badges*). */
/** What staleness reads of a cell's derivation: where it is placed. */
export type CellPoint = Pick<CellDerivation, 'kind'> & {
  branch?: string;
  commit?: string;
};

const pointOf = (d: CellPoint | undefined) =>
  d?.kind === 'ok' && d.commit !== undefined && d.branch !== undefined
    ? { branch: d.branch, commit: d.commit }
    : undefined;

/** Answered: data from a fetch that didn't fail (rate limits keep it). */
const answered = (snap: Snapshot<GithubData['compare']>) =>
  snap.failed && !isRateLimit(snap.error) ? undefined : snap.data?.data;

/** Every stage's staleness for one row, and the compares it needs; each
 * compare goes through the link of the cell being compared. */
export function rowStaleness(
  linkFor: (stageId: string) => GitLink | undefined,
  stages: readonly Stage[],
  cells: Readonly<Partial<Record<string, { derivation: CellPoint }>>>,
): { staleness: Partial<Record<string, CellStaleness>>; needs: Need[] } {
  const staleness: Partial<Record<string, CellStaleness>> = {};
  const needs: Need[] = [];
  for (const stage of stages) {
    const link = linkFor(stage.id);
    const own = pointOf(cells[stage.id]?.derivation);
    const source = stage.sourceStageId
      ? pointOf(cells[stage.sourceStageId]?.derivation)
      : undefined;
    if (!link || !own || !source || own.branch === source.branch) {
      staleness[stage.id] = UNBADGED;
      continue;
    }
    const pair = (base: string, head: string) => {
      const request = { call: 'compare', repo: link.repo, base, head } as const;
      needs.push({
        key: githubKey(link.credentialId, request),
        freshness: pollEvery(IDLE_INTERVAL_MS, link.overBudget),
        version: `${own.commit}|${source.commit}`,
      });
      return githubSnapshot(link.client, link.credentialId, request);
    };
    const forwardSnap = pair(own.branch, source.branch);
    const forward = answered(forwardSnap);
    // The reverse compare only lists the commits the cell has that its
    // source lacks: with none (`behind_by` 0) there is nothing to read.
    const reverseSnap =
      forward && forward.behind_by > 0
        ? pair(source.branch, own.branch)
        : undefined;
    const reverse = reverseSnap ? answered(reverseSnap) : undefined;
    if (!forward || (reverseSnap && !reverse)) {
      const failed = forwardSnap.failed || (reverseSnap?.failed ?? false);
      staleness[stage.id] = { badge: undefined, settled: failed };
      continue;
    }
    staleness[stage.id] = {
      settled: true,
      badge: deriveStalenessBadge({
        cellBranch: own.branch,
        sourceBranch: source.branch,
        compare: { aheadBy: forward.ahead_by, behindBy: forward.behind_by },
      }),
      compare: {
        sourceBranch: source.branch,
        htmlUrl: forward.html_url,
        behindSubjects: commitSubjects(forward),
        aheadSubjects: reverse ? commitSubjects(reverse) : [],
      },
    };
  }
  return { staleness, needs };
}
