/**
 * A board cell from its key (spec.md C-13, §3.11): its row's and stage's
 * names, and the settings it reads with their origins, for its detail.
 * Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import {
  type CellSettingLine,
  cellSettingLines,
} from '@/editors/settings/origins';
import { CellKeySchema } from '@/engine';

/** The row and stage names of the cell at `key` (ids if missing). */
export function cellNames(
  d: Pick<Dashboard, 'rows' | 'stages'>,
  key: string,
): { rowName: string; stageName: string } {
  const [rowId, stageId] = CellKeySchema.parse(JSON.parse(key));
  return {
    rowName: d.rows.find((r) => r.id === rowId)?.displayName ?? rowId,
    stageName: d.stages.find((s) => s.id === stageId)?.name ?? stageId,
  };
}

/** The settings the cell at `key` reads, with origins. */
export function cellSettingsAt(d: Dashboard, key: string): CellSettingLine[] {
  const [rowId, stageId] = CellKeySchema.parse(JSON.parse(key));
  const row = d.rows.find((r) => r.id === rowId);
  return row ? cellSettingLines(d, row, stageId) : [];
}
