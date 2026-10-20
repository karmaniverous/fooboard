/**
 * Which status set a cell uses (spec.md A§4.3.6), and checks that every
 * reference to one resolves. A set is a bundled preset or one of the
 * dashboard's own (custom) sets, for one provider. The cell's own choice
 * beats its row's, then its row group's, then the dashboard's default for
 * the row's provider; a chosen set replaces the inherited one outright.
 *
 * @module
 */
import { groupOf, type RowGroup } from '@/domain/config/groups';
import { type Provider } from '@/domain/config/providers';
import type { Row } from '@/domain/config/row';
import {
  DEFAULT_STATUS_SET_IDS,
  type StatusSet,
} from '@/domain/config/statusSets';

import { presetById, PRESETS } from './presets';

/** What resolution needs of a dashboard. */
export interface StatusSetScope {
  statusSets: Record<Provider, string>;
  customStatusSets: readonly StatusSet[];
  rowGroups: readonly RowGroup[];
}

const providerOf = (row: Pick<Row, 'type'>): Provider => row.type;

/** The set with `id`: a bundled preset, or one of `custom`. */
export const findStatusSet = (
  id: string,
  custom: readonly StatusSet[] = [],
): StatusSet | undefined =>
  PRESETS.find((p) => p.id === id) ?? custom.find((s) => s.id === id);

/** The id of the set a row inherits: its row group's, else the
 * dashboard's, for the row's provider. */
export function inheritedStatusSetId(
  scope: Pick<StatusSetScope, 'statusSets' | 'rowGroups'>,
  row: Row,
): string {
  const provider = providerOf(row);
  return (
    groupOf(scope.rowGroups, row.id)?.statusSets[provider] ??
    scope.statusSets[provider]
  );
}

/** Where the set a row's cell uses is chosen; a row group names itself. */
export type StatusSetSource =
  | { id: string; from: 'cell' | 'row' | 'dashboard' }
  | { id: string; from: 'rowGroup'; groupId: string };

/** The id of the set a row's cell in `stageId` uses, and the level that
 * chose it. */
export function statusSetSource(
  scope: Pick<StatusSetScope, 'statusSets' | 'rowGroups'>,
  row: Row,
  stageId?: string,
): StatusSetSource {
  const cell = stageId === undefined ? undefined : row.cellStatusSets[stageId];
  if (cell) return { id: cell, from: 'cell' };
  if (row.statusSet) return { id: row.statusSet, from: 'row' };
  const group = groupOf(scope.rowGroups, row.id);
  const fromGroup = group?.statusSets[providerOf(row)];
  if (group && fromGroup)
    return { id: fromGroup, from: 'rowGroup', groupId: group.id };
  return { id: inheritedStatusSetId(scope, row), from: 'dashboard' };
}

/** The set a row's cell in `stageId` uses. An unknown id, or a set for
 * another source, falls back to the provider's default preset and is
 * reported as a rule problem (spec.md A§4.3.7), never thrown. */
export function statusSetFor(
  scope: StatusSetScope,
  row: Row,
  stageId?: string,
): StatusSet {
  const { id } = statusSetSource(scope, row, stageId);
  const provider = providerOf(row);
  const found = findStatusSet(id, scope.customStatusSets);
  if (found?.provider === provider) return found;
  return presetById(DEFAULT_STATUS_SET_IDS[provider]);
}

type Issue = { message: string; path: (string | number)[] };

/** Integrity problems with status sets: custom sets clashing with a
 * preset or each other, and cell choices for stages the dashboard doesn't
 * have. (References that don't resolve are rule problems.) */
export function statusSetReferenceIssues(
  dashboard: Pick<StatusSetScope, 'customStatusSets'> & {
    rows: readonly Row[];
    stages: readonly { id: string }[];
  },
): Issue[] {
  const custom = dashboard.customStatusSets;
  const issues: Issue[] = [];
  const seen = new Set<string>();
  custom.forEach((s, i) => {
    const path = ['customStatusSets', i, 'id'];
    if (PRESETS.some((p) => p.id === s.id))
      issues.push({ message: `status set id ${s.id} is a preset's`, path });
    else if (seen.has(s.id))
      issues.push({ message: `duplicate status set id: ${s.id}`, path });
    seen.add(s.id);
  });
  const stageIds = new Set(dashboard.stages.map((s) => s.id));
  dashboard.rows.forEach((row, ri) => {
    for (const stageId of Object.keys(row.cellStatusSets))
      if (!stageIds.has(stageId))
        issues.push({
          message: `status set for unknown stage: ${stageId}`,
          path: ['rows', ri, 'cellStatusSets', stageId],
        });
  });
  return issues;
}
