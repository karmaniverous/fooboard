/**
 * Runs that matched no status (spec.md A§4.3.6): the board's Unknown
 * cells, and *Add status*, which puts a new status on top of the set the
 * cell uses, with a rule drafted to match the cell's record. A preset is copied into the
 * dashboard first, and the copy chosen at the level that chose the preset
 * (cell, row, row group or dashboard), so only cells that already shared
 * the set move to the copy. Pure.
 *
 * @module
 */
import { z } from 'zod';

import type { Dashboard } from '@/domain/config/dashboard';
import type { Row } from '@/domain/config/row';
import { UNKNOWN_STATUS_ID } from '@/domain/config/statusSets';
import { all, exists, is, not } from '@/domain/model/ruleBuilders';
import { escapeGlob } from '@/domain/rules/glob';
import type { Rule } from '@/domain/rules/schema';
import { statusSetFor, statusSetSource } from '@/domain/statuses/resolve';
import { type BoardModel, cellKey } from '@/engine';

import { addCellStatus, copySet, updateSet } from './customSet';
import {
  setCellStatusSet,
  setDashboardStatusSet,
  setGroupStatusSet,
  setRowStatusSet,
} from './overrideSets';

export interface UnknownCell {
  rowId: string;
  rowName: string;
  stageId: string;
  stageName: string;
  setName: string;
  /** The record the set's rules saw. */
  document: unknown;
}

/** The board's Unknown cells, in board order. */
export function unknownCells(
  dashboard: Dashboard,
  model: Pick<BoardModel, 'cells'>,
): UnknownCell[] {
  return dashboard.rows.flatMap((row) =>
    dashboard.stages.flatMap((stage) => {
      const d = model.cells[cellKey(row.id, stage.id)]?.derivation;
      if (d?.kind !== 'ok' || d.status.id !== UNKNOWN_STATUS_ID) return [];
      return [
        {
          rowId: row.id,
          rowName: row.displayName,
          stageId: stage.id,
          stageName: stage.name,
          setName: statusSetFor(dashboard, row, stage.id).name,
          document: d.document,
        },
      ];
    }),
  );
}

/** Point the level that chose this cell's set at `to`. */
function chooseAt(
  dashboard: Dashboard,
  row: Row,
  stageId: string,
  to: string,
): Dashboard {
  const source = statusSetSource(dashboard, row, stageId);
  switch (source.from) {
    case 'cell':
      return setCellStatusSet(dashboard, row.id, stageId, to);
    case 'row':
      return setRowStatusSet(dashboard, row.id, to);
    case 'rowGroup':
      return setGroupStatusSet(dashboard, source.groupId, row.type, to);
    case 'dashboard':
      return setDashboardStatusSet(dashboard, row.type, to);
  }
}

/** What a first rule needs of a record: a GitHub run's workflow and
 * items' states, or an Amplify job's state. */
const DraftSourceSchema = z.union([
  z.object({
    workflow: z.string(),
    items: z.array(z.object({ state: z.string().nullable() })),
  }),
  z.object({ state: z.string().nullable() }),
]);

const stateIs = (path: string, state: string | null | undefined) =>
  state ? is(path, escapeGlob(state)) : not(exists(path));

/** A first rule for `record`: its workflow and first item's state, or its
 * state. Edited from there; a record of neither shape gets a rule matching
 * nothing. */
function draftRule(record: unknown): Rule {
  const parsed = DraftSourceSchema.safeParse(record);
  if (!parsed.success) return all(not(exists('$')));
  const doc = parsed.data;
  if ('state' in doc) return all(stateIs('$.state', doc.state));
  return all(
    is('$.workflow', escapeGlob(doc.workflow)),
    stateIs('$.items[*].state', doc.items.at(0)?.state),
  );
}

/** Add a status for `cell`'s run on top of the set its cell uses. */
export function addStatusFor(
  dashboard: Dashboard,
  cell: Pick<UnknownCell, 'rowId' | 'stageId' | 'document'>,
): Dashboard {
  const row = dashboard.rows.find((r) => r.id === cell.rowId);
  if (!row) return dashboard;
  const used = statusSetFor(dashboard, row, cell.stageId);
  const owned = dashboard.customStatusSets.some((s) => s.id === used.id);
  const copied = owned ? undefined : copySet(dashboard, used.id);
  const next = copied
    ? chooseAt(copied.dashboard, row, cell.stageId, copied.copy.id)
    : dashboard;
  return updateSet(next, copied?.copy.id ?? used.id, (set) => {
    const added = addCellStatus(set);
    const [first, ...rest] = added.cell;
    return {
      ...added,
      cell: [{ ...first, rule: draftRule(cell.document) }, ...rest],
    };
  });
}
