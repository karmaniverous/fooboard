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
import type { Row } from '@/domain/config/row';
import {
  DEFAULT_STATUS_SET_IDS,
  STATUS_PROVIDERS,
  type StatusProvider,
  type StatusSet,
} from '@/domain/config/statusSets';

import { presetById, PRESETS } from './presets';

/** What resolution needs of a dashboard. */
export interface StatusSetScope {
  statusSets: Record<StatusProvider, string>;
  customStatusSets: readonly StatusSet[];
  rowGroups: readonly RowGroup[];
}

const providerOf = (row: Pick<Row, 'type'>): StatusProvider => row.type;

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

/** The set a row's cell in `stageId` uses. References are validated when
 * the dashboard is parsed, so an unknown id only reaches here through a
 * bug; it falls back to the provider's default preset rather than throwing. */
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

/** Every status-set reference that doesn't name a set of the right
 * provider, custom sets clashing with a preset or each other, and cell
 * choices for stages the dashboard doesn't have. */
export function statusSetReferenceIssues(
  dashboard: StatusSetScope & {
    rows: readonly Row[];
    stages: readonly { id: string }[];
  },
): Issue[] {
  const custom = dashboard.customStatusSets;
  const issues: Issue[] = [];
  const check = (
    id: string,
    provider: StatusProvider,
    path: (string | number)[],
  ) => {
    const set = findStatusSet(id, custom);
    if (!set) issues.push({ message: `unknown status set: ${id}`, path });
    else if (set.provider !== provider)
      issues.push({
        message: `status set ${id} is for ${set.provider}, expected ${provider}`,
        path,
      });
  };
  const seen = new Set<string>();
  custom.forEach((s, i) => {
    const path = ['customStatusSets', i, 'id'];
    if (PRESETS.some((p) => p.id === s.id))
      issues.push({ message: `status set id ${s.id} is a preset's`, path });
    else if (seen.has(s.id))
      issues.push({ message: `duplicate status set id: ${s.id}`, path });
    seen.add(s.id);
  });
  for (const provider of STATUS_PROVIDERS)
    check(dashboard.statusSets[provider], provider, ['statusSets', provider]);
  dashboard.rowGroups.forEach((g, gi) => {
    for (const provider of STATUS_PROVIDERS) {
      const id = g.statusSets[provider];
      if (id) check(id, provider, ['rowGroups', gi, 'statusSets', provider]);
    }
  });
  const stageIds = new Set(dashboard.stages.map((s) => s.id));
  dashboard.rows.forEach((row, ri) => {
    const provider = providerOf(row);
    if (row.statusSet)
      check(row.statusSet, provider, ['rows', ri, 'statusSet']);
    for (const [stageId, id] of Object.entries(row.cellStatusSets)) {
      const path = ['rows', ri, 'cellStatusSets', stageId];
      if (!stageIds.has(stageId))
        issues.push({
          message: `status set for unknown stage: ${stageId}`,
          path,
        });
      else check(id, provider, path);
    }
  });
  return issues;
}
