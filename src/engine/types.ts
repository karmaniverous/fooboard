/**
 * Board model types (spec.md §3.1): the per-dashboard cell model the UI
 * renders. Cells hold the domain derivation plus the staleness badge and
 * compare detail, and say whether they are provisional (shown from the
 * run alone until its jobs land), refreshing (cached data whose newer
 * state is still loading) and settled (final: nothing they show is still
 * loading for the first time).
 *
 * @module
 */
import type { JSONValue } from 'json-p3';
import { z } from 'zod';

import type { Provider } from '@/domain/config/providers';
import type {
  CellDerivation,
  StalenessBadge,
  UnmappedReason,
} from '@/domain/derivation';
import type { RecordDoc } from '@/domain/model/translate';
import type { Problem } from '@/domain/problems/problem';
import type { RateLimitBudget } from '@/lib/github';

/** Compare detail for a cell with a source stage (spec.md §2.7). */
export interface CompareDetail {
  sourceBranch: string;
  htmlUrl: string;
  /** Commits the source has that the cell lacks (why it's behind). */
  behindSubjects: string[];
  /** Commits the cell has that the source lacks (why it's diverged). */
  aheadSubjects: string[];
}

/** How a provisional cell looks (Decision 37): in a summary status
 * matched by name, or neutral when its set has none of that name. */
export type ProvisionalLook = 'status' | 'neutral';

/** One rendered cell. */
export interface BoardCell {
  rowId: string;
  stageId: string;
  derivation: CellDerivation;
  /** Still queued or running (or provisionally *Running*); drives the
   * fast poll even when the displayed status is final (e.g. a failed
   * test with a deploy still running). */
  active: boolean;
  badge: StalenessBadge;
  compare?: CompareDetail;
  /** Shown from the run's own state until its jobs land (§3.1). */
  provisional?: ProvisionalLook;
  /** Cached data shown while newer data loads (§3.1). */
  refreshing?: boolean;
  /** Nothing the cell shows is still loading for the first time: not
   * provisional, and its compares have answered (Decision 30). */
  settled: boolean;
}

/** What a row's derivation yields per cell, before staleness. */
export type CellView = Pick<
  BoardCell,
  'derivation' | 'active' | 'provisional' | 'refreshing'
> & {
  /** Waiting for jobs that may change it. */
  pending: boolean;
};

/** A record the board couldn't place, for the Unmapped panel (C-15,
 * spec.md §2.5): a GitHub run or an Amplify job. */
export interface UnmappedRun {
  provider: Provider;
  /** Unique on the board; a record is listed once per repo or app, not
   * per row. */
  id: string;
  /** What was read: the repo (`owner/name`) or the Amplify app. */
  where: string;
  /** The run's workflow, or the Amplify job. */
  title: string;
  branch: string | null;
  htmlUrl: string;
  /** The translated record, to draft a check from (*Add rule*). */
  record: RecordDoc;
  /** The first row's reason (one row reads most repos). */
  reason: UnmappedReason;
  /** Why each row reading the repo didn't place it (spec.md §2.5). */
  rows: { rowId: string; reason: UnmappedReason }[];
}

/** Everything the board renders for one dashboard. */
export interface BoardModel {
  /** Keyed by `cellKey(rowId, stageId)`; a cell is absent until its row
   * has data for it. */
  cells: Partial<Record<string, BoardCell>>;
  unmapped: UnmappedRun[];
  /** Problems found while reading (spec.md §2.5, Decisions 25 and 26):
   * translation problems, window hints, read errors, renamed repos. */
  problems: Problem[];
  /** Entries of the Amplify branch lists read, for the branch rule's
   * field picker and preview. */
  amplifyBranches: JSONValue[];
  /** Latest known GitHub budget per credential id; `undefined` until the
   * token's first response (Decision 6). */
  budgets: Record<string, RateLimitBudget | undefined>;
  /** When each row's data last landed (ms), keyed by row id. */
  refreshedAt: Record<string, number>;
}

/** A cell key parsed back into its row and stage ids. */
export const CellKeySchema = z.tuple([z.string(), z.string()]);

/** The key of one cell in `BoardModel.cells`. Ids may contain any
 * character, so the pair is encoded unambiguously. */
export const cellKey = (rowId: string, stageId: string): string =>
  JSON.stringify([rowId, stageId]);
