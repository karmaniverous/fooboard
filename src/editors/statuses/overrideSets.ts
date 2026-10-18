/**
 * Status-set choices below the dashboard (spec.md A§4.3.6): a row group's
 * per provider, a row's, and a single cell's. `''` clears a choice, so the
 * level inherits again. What each level inherits is shown in the editor.
 * Pure.
 *
 * @module
 */
import { omit } from 'radash';

import type { Dashboard } from '@/domain/config/dashboard';
import { groupOf } from '@/domain/config/groups';
import type { Row } from '@/domain/config/row';
import type { StatusProvider } from '@/domain/config/statusSets';

export function setGroupStatusSet(
  dashboard: Dashboard,
  groupId: string,
  provider: StatusProvider,
  id: string,
): Dashboard {
  return {
    ...dashboard,
    rowGroups: dashboard.rowGroups.map((g) =>
      g.id === groupId
        ? {
            ...g,
            statusSets: id
              ? { ...g.statusSets, [provider]: id }
              : omit(g.statusSets, [provider]),
          }
        : g,
    ),
  };
}

const updateRow = (
  dashboard: Dashboard,
  rowId: string,
  change: (row: Row) => Row,
): Dashboard => ({
  ...dashboard,
  rows: dashboard.rows.map((r) => (r.id === rowId ? change(r) : r)),
});

export const setRowStatusSet = (
  dashboard: Dashboard,
  rowId: string,
  id: string,
): Dashboard =>
  updateRow(dashboard, rowId, (r) => ({ ...r, statusSet: id || undefined }));

export const setCellStatusSet = (
  dashboard: Dashboard,
  rowId: string,
  stageId: string,
  id: string,
): Dashboard =>
  updateRow(dashboard, rowId, (r) => ({
    ...r,
    cellStatusSets: id
      ? { ...r.cellStatusSets, [stageId]: id }
      : omit(r.cellStatusSets, [stageId]),
  }));

/** The set id a row inherits (its group's, else the dashboard's). */
export function rowInherits(dashboard: Dashboard, row: Row): string {
  return (
    groupOf(dashboard.rowGroups, row.id)?.statusSets[row.type] ??
    dashboard.statusSets[row.type]
  );
}
