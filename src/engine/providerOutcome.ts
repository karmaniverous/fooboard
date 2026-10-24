/**
 * What a row shows when one of its queries failed (spec.md §3.1,
 * Decisions 25 and 26), shared by GitHub and Amplify rows: a rate limit
 * keeps the cached data; a rejected credential shows *Needs credential*;
 * not found (404, or Amplify's `NotFoundException`) shows *Error: not
 * found* with a problem whose Fix opens the row; anything else shows
 * *Error* with its message and a dismissable problem. Only rate limiting
 * keeps cached data.
 *
 * @module
 */
import type { StatusSet } from '@/domain/config/statusSets';
import {
  type EditTarget,
  type Problem,
  problem,
} from '@/domain/problems/problem';
import { errorMessage } from '@/lib/errors';
import { isAuthFailure, isNotFound, isRateLimit } from '@/query/errors';

import { emptyViews } from './cells';
import type { Need, RowDerivation } from './need';
import type { CellView } from './types';

/** The cell text for a repo or app that is gone. */
export const NOT_FOUND = 'not found';

/** How a failed query renders, or `undefined` when its data stands. */
export type FailureOutcome =
  | { kind: 'needs-credential' }
  | { kind: 'not-found' }
  | { kind: 'error'; message: string };

/** The outcome of a query that failed with `error` (when `failed`). */
export function failureOutcome(
  failed: boolean,
  error: unknown,
): FailureOutcome | undefined {
  if (!failed || isRateLimit(error)) return undefined;
  if (isAuthFailure(error)) return { kind: 'needs-credential' };
  if (isNotFound(error)) return { kind: 'not-found' };
  return { kind: 'error', message: errorMessage(error) };
}

/** A row's cells for `outcome`. */
export function failedViews(
  outcome: FailureOutcome,
  stages: readonly { id: string }[],
  setFor: (stageId: string) => StatusSet,
): Record<string, CellView> {
  if (outcome.kind === 'needs-credential')
    return emptyViews(stages, setFor, 'expired');
  const message = outcome.kind === 'not-found' ? NOT_FOUND : outcome.message;
  return emptyViews(stages, setFor, 'ok', { message, isRateLimit: false });
}

/** One cell (in `set`) for `outcome`. */
export const failedView = (
  outcome: FailureOutcome,
  set: StatusSet,
): CellView | undefined =>
  failedViews(outcome, [{ id: 'cell' }], () => set).cell;

/** A row whose read of `what` failed with `outcome`: every cell shows
 * it, with its problem; the row keeps observing `needs`. */
export function failedDerivation(
  outcome: FailureOutcome,
  row: { id: string; stages: readonly { id: string }[] },
  setFor: (stageId: string) => StatusSet,
  what: string,
  needs: Need[],
): RowDerivation {
  const note = failureProblem(outcome, row.id, what);
  return {
    cells: failedViews(outcome, row.stages, setFor),
    needs,
    problems: note ? [note] : [],
  };
}

/** A problem on row `rowId` whose Fix opens the row. */
export function rowProblem(
  rowId: string,
  message: string,
  dismissable: boolean,
  target: EditTarget = { kind: 'row', id: rowId },
): Problem {
  return problem({ kind: 'row', id: rowId }, message, dismissable, { target });
}

/** The board problem for `outcome` reading `what` for row `rowId`. */
export function failureProblem(
  outcome: FailureOutcome,
  rowId: string,
  what: string,
): Problem | undefined {
  if (outcome.kind === 'needs-credential') return undefined;
  if (outcome.kind === 'not-found')
    return rowProblem(
      rowId,
      `${what} wasn't found, or its credential can no longer see it: re-pick or remove it`,
      false,
    );
  return rowProblem(rowId, `Couldn't read ${what}: ${outcome.message}`, true);
}
