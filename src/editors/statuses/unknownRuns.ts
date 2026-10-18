/**
 * Runs that matched no status (spec.md A§4.3.6): the board's Unknown
 * cells, and *Add status*, which puts a new status on top of the set the
 * cell uses, drafted to match the cell's run. A preset is copied into the
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
import { statusSetFor, statusSetSource } from '@/domain/statuses/resolve';
import { oneOf } from '@/domain/statuses/schemaBuilders';
import { type Condition, toSchema } from '@/domain/statuses/testForm';
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
  /** The run (or Amplify job) document the set's tests saw. */
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

/** What a first test needs of a document: an Amplify job's status, or a
 * GitHub run's workflow and first job. */
const DraftSourceSchema = z.union([
  z.object({ status: z.string().nullable() }),
  z.object({
    workflow: z.string(),
    jobs: z.array(
      z.object({ status: z.string(), conclusion: z.string().nullable() }),
    ),
  }),
]);

/** A first test for the run in `document`: its Amplify status, or its
 * workflow and first job's conclusion. Edited from there; a document of
 * neither shape gets a test matching nothing. */
function draftTest(document: unknown): Record<string, unknown> {
  const parsed = DraftSourceSchema.safeParse(document);
  if (!parsed.success) return { not: {} };
  const doc = parsed.data;
  // Exact, so a job with no status yet (null) is matched too.
  if ('status' in doc) return oneOf('status', [doc.status]);
  // A job that hasn't finished has no conclusion: test its status.
  const job = doc.jobs.at(0);
  const jobCondition: Condition = job?.conclusion
    ? {
        scope: 'anyJob',
        field: 'conclusion',
        operator: 'is',
        value: job.conclusion,
      }
    : {
        scope: 'anyJob',
        field: 'status',
        operator: 'is',
        value: job?.status ?? '',
      };
  return toSchema([
    { scope: 'value', field: 'workflow', operator: 'is', value: doc.workflow },
    jobCondition,
  ]);
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
      cell: [{ ...first, test: draftTest(cell.document) }, ...rest],
    };
  });
}
