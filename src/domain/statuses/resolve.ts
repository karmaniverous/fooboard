/**
 * Which status set a cell uses (spec.md A§4.3.6, §3.11), and checks that
 * every reference to one resolves. A set is a bundled preset or one of
 * the dashboard's own (custom) sets, for one provider. The set id is a
 * setting, resolved per cell by the settings resolver; a chosen set
 * replaces the inherited one outright.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import type { Row } from '@/domain/config/row';
import {
  DEFAULT_STATUS_SET_IDS,
  type StatusSet,
} from '@/domain/config/statusSets';
import { resolveSetting } from '@/domain/settings/resolve';

import { presetById, PRESETS } from './presets';

/** The set with `id`: a bundled preset, or one of `custom`. */
export const findStatusSet = (
  id: string,
  custom: readonly StatusSet[] = [],
): StatusSet | undefined =>
  PRESETS.find((p) => p.id === id) ?? custom.find((s) => s.id === id);

/** The set a row's cell in `stageId` uses. An unknown id, or a set for
 * another source, falls back to the provider's default preset and is
 * reported as a rule problem (spec.md A§4.3.7), never thrown. */
export function statusSetFor(
  dashboard: Dashboard,
  row: Pick<Row, 'id' | 'type'>,
  stageId: string,
): StatusSet {
  const id = resolveSetting(dashboard, row, stageId, 'statusSets').value;
  const found = findStatusSet(id, dashboard.customStatusSets);
  if (found?.provider === row.type) return found;
  return presetById(DEFAULT_STATUS_SET_IDS[row.type]);
}

type Issue = { message: string; path: (string | number)[] };

/** Integrity problems with status sets and cells: custom sets clashing
 * with a preset or each other, and cell settings for stages the dashboard
 * doesn't have. (References that don't resolve are rule problems.) */
export function statusSetReferenceIssues(
  dashboard: Pick<Dashboard, 'customStatusSets'> & {
    rows: readonly Pick<Row, 'cellSettings'>[];
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
    for (const stageId of Object.keys(row.cellSettings))
      if (!stageIds.has(stageId))
        issues.push({
          message: `settings for unknown stage: ${stageId}`,
          path: ['rows', ri, 'cellSettings', stageId],
        });
  });
  return issues;
}
