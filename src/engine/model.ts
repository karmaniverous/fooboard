/**
 * The board model's pure updates (spec.md C-16, C-17): the empty model,
 * with a battery slot for every GitHub token, and a target's refreshed
 * rows applied to the model.
 *
 * @module
 */
import type { Stage } from '@/domain/config/stage';

import type { CellStaleness } from './staleness';
import { type BoardModel, cellKey, type CellView } from './types';

/** One row's refreshed cells and their staleness, by stage id. */
export interface RowUpdate {
  cells: Partial<Record<string, CellView>>;
  staleness: Record<string, CellStaleness>;
}

/** A model with nothing loaded yet: a budget slot (unknown so far) for
 * each GitHub token in `credentialIds`, so every battery shows at once. */
export const emptyModel = (
  credentialIds: readonly string[] = [],
): BoardModel => ({
  cells: {},
  unmapped: [],
  problems: [],
  amplifyBranches: [],
  budgets: Object.fromEntries(credentialIds.map((id) => [id, undefined])),
  refreshedAt: {},
});

/** `model`'s cells and refresh times with `rows` applied, refreshed
 * `at`; a stage a row did not report keeps its cell. */
export function withRows(
  model: BoardModel,
  stages: readonly Stage[],
  rows: Readonly<Record<string, RowUpdate>>,
  at: number,
): Pick<BoardModel, 'cells' | 'refreshedAt'> {
  const cells = { ...model.cells };
  const refreshedAt = { ...model.refreshedAt };
  for (const [rowId, row] of Object.entries(rows)) {
    for (const stage of stages) {
      const view = row.cells[stage.id];
      if (!view) continue;
      cells[cellKey(rowId, stage.id)] = {
        rowId,
        stageId: stage.id,
        ...view,
        ...(row.staleness[stage.id] ?? { badge: undefined }),
      };
    }
    refreshedAt[rowId] = at;
  }
  return { cells, refreshedAt };
}
