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
import { groupOf } from '@/domain/config/groups';
import type { Row } from '@/domain/config/row';
import { UNKNOWN_STATUS_ID } from '@/domain/config/statusSets';
import { statusSetFor } from '@/domain/statuses/resolve';
import { toSchema } from '@/domain/statuses/testForm';
import type { BoardModel } from '@/engine';

import { addCellStatus, copySet, updateSet } from './customSet';

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
  const cells = Object.values(model.cells);
  return dashboard.rows.flatMap((row) =>
    dashboard.stages.flatMap((stage) => {
      const cell = cells.find(
        (c) => c?.rowId === row.id && c.stageId === stage.id,
      );
      const d = cell?.derivation;
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

/** Point whichever level chose `from` for this cell at `to`. */
function chooseAt(
  dashboard: Dashboard,
  row: Row,
  stageId: string,
  to: string,
): Dashboard {
  const setRow = (
    change: Partial<Pick<Row, 'statusSet' | 'cellStatusSets'>>,
  ): Dashboard => ({
    ...dashboard,
    rows: dashboard.rows.map((r) =>
      r.id === row.id ? { ...r, ...change } : r,
    ),
  });
  if (row.cellStatusSets[stageId])
    return setRow({ cellStatusSets: { ...row.cellStatusSets, [stageId]: to } });
  if (row.statusSet) return setRow({ statusSet: to });
  const group = groupOf(dashboard.rowGroups, row.id);
  if (group?.statusSets[row.type])
    return {
      ...dashboard,
      rowGroups: dashboard.rowGroups.map((g) =>
        g.id === group.id
          ? { ...g, statusSets: { ...g.statusSets, [row.type]: to } }
          : g,
      ),
    };
  return {
    ...dashboard,
    statusSets: { ...dashboard.statusSets, [row.type]: to },
  };
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
  if ('status' in doc)
    return toSchema([
      {
        scope: 'value',
        field: 'status',
        operator: 'oneOf',
        value: doc.status ?? '',
      },
    ]);
  const job = doc.jobs.at(0);
  return toSchema([
    { scope: 'value', field: 'workflow', operator: 'is', value: doc.workflow },
    {
      scope: 'anyJob',
      field: 'conclusion',
      operator: 'is',
      value: job ? (job.conclusion ?? job.status) : '',
    },
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
  let next = dashboard;
  let id = used.id;
  if (!dashboard.customStatusSets.some((s) => s.id === used.id)) {
    ({ dashboard: next, id } = copySet(dashboard, used.id));
    next = chooseAt(next, row, cell.stageId, id);
  }
  return updateSet(next, id, (set) => {
    const added = addCellStatus(set);
    const [first, ...rest] = added.cell;
    return {
      ...added,
      cell: [{ ...first, test: draftTest(cell.document) }, ...rest],
    };
  });
}
