/**
 * Board engine types (spec.md §8 step 7): the per-dashboard cell model the
 * UI renders, and the provider lookup the engine reads through. Cells hold
 * the domain derivation plus the staleness badge and compare detail.
 *
 * @module
 */
import { z } from 'zod';

import type {
  CellDerivation,
  StalenessBadge,
  UnmappedReason,
} from '@/domain/derivation';
import type { Problem } from '@/domain/problems/problem';
import type { AmplifyReaderFor } from '@/lib/amplify/rowJobs';
import type { GitHubReader } from '@/lib/github';
import type { RateLimitBudget } from '@/lib/github';

/** Compare detail for a cell with a source stage (spec.md §4.3.5). */
export interface CompareDetail {
  sourceBranch: string;
  htmlUrl: string;
  /** Commits the source has that the cell lacks (why it's behind). */
  behindSubjects: string[];
  /** Commits the cell has that the source lacks (why it's diverged). */
  aheadSubjects: string[];
}

/** One rendered cell. */
export interface BoardCell {
  rowId: string;
  stageId: string;
  derivation: CellDerivation;
  /** A job in the cell's run is still queued or running; drives the fast
   * poll even when the displayed status is final (e.g. a failed test with
   * a deploy still running). */
  active: boolean;
  badge: StalenessBadge;
  compare?: CompareDetail;
}

/** A run the board couldn't place, for the Unmapped runs panel (C-15). */
export interface UnmappedRun {
  /** `owner/name`; a run is listed once per repo, not per row. */
  repo: string;
  runId: number;
  workflowName: string;
  branch: string | null;
  htmlUrl: string;
  /** The first row's reason (one row reads most repos). */
  reason: UnmappedReason;
  /** Why each row reading the repo didn't place it (spec.md A§4.3.7). */
  rows: { rowId: string; reason: UnmappedReason }[];
}

/** Everything the board renders for one dashboard. */
export interface BoardModel {
  /** Keyed by `cellKey(rowId, stageId)`; a cell is absent until its row
   * first refreshes. */
  cells: Partial<Record<string, BoardCell>>;
  unmapped: UnmappedRun[];
  /** Problems found while reading (spec.md A§4.3.7): translation
   * problems and window hints. */
  problems: Problem[];
  /** Latest known GitHub budget per credential id (spec.md C-16). */
  budgets: Record<string, RateLimitBudget | undefined>;
  /** When each row last refreshed (ms), keyed by row id. */
  refreshedAt: Record<string, number>;
}

/** The key of one cell in `BoardModel.cells`. */
/** Ids may contain any character, so the pair is encoded unambiguously. */
/** A cell key parsed back into its row and stage ids. */
export const CellKeySchema = z.tuple([z.string(), z.string()]);

export const cellKey = (rowId: string, stageId: string): string =>
  JSON.stringify([rowId, stageId]);

/** Readers for the dashboard's credentials; `undefined` means the
 * credential is missing (no token or key entered), so its cells show
 * *needs credential*. */
export interface EngineProviders {
  github(credentialId: string): GitHubReader | undefined;
  amplify(credentialId: string): AmplifyReaderFor | undefined;
}
