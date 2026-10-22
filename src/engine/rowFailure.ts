/**
 * A row whose derivation threw (spec.md §3.1, Decision 25): every cell
 * shows *Error* with the exception's message, and the board gets a
 * dismissable problem on the row, instead of the exception being dropped
 * or breaking the board. The row keeps observing what it observed before,
 * so a later landing re-derives it and it can recover. Pure.
 *
 * @module
 */
import { cellRulesFor } from '@/domain/config/cellRules';
import type { Dashboard } from '@/domain/config/dashboard';
import type { Row } from '@/domain/config/row';
import { describeError } from '@/lib/errors';

import { failedViews, rowProblem } from './providerOutcome';
import type { RowEntry } from './rowDerive';
import type { BoardCell } from './types';

/** `row`'s entry after its derivation threw `error`; `previous` is the
 * entry it had, whose needs and groups it keeps. */
export function failedRow(
  dashboard: Dashboard,
  row: Row,
  error: unknown,
  previous: RowEntry | undefined,
): RowEntry {
  const message = describeError(error);
  const views = failedViews(
    { kind: 'error', message },
    dashboard.stages,
    (id) => cellRulesFor(dashboard, row, id).set,
  );
  const cells: BoardCell[] = Object.entries(views).map(([stageId, view]) => ({
    rowId: row.id,
    stageId,
    derivation: view.derivation,
    active: false,
    badge: undefined,
    settled: true,
  }));
  const note = rowProblem(
    row.id,
    `Couldn't show ${row.displayName}: ${message}`,
    true,
  );
  return {
    cells,
    needs: previous?.needs ?? [],
    derivation: { cells: views, needs: [], problems: [note] },
    groups: previous?.groups ?? [],
  };
}
