/**
 * Where a problem is, in words (spec.md A§4.3.7). Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import type { ProblemLevel } from '@/domain/problems/problems';

const nameOf = (
  items: readonly { id: string; name: string | undefined }[],
  id: string,
): string => items.find((i) => i.id === id)?.name ?? id;

export function levelLabel(dashboard: Dashboard, level: ProblemLevel): string {
  const rows = dashboard.rows.map((r) => ({ id: r.id, name: r.displayName }));
  const stages = dashboard.stages.map((s) => ({ id: s.id, name: s.name }));
  const groups = (gs: readonly { id: string; label?: string }[]) =>
    gs.map((g) => ({ id: g.id, name: g.label }));
  switch (level.kind) {
    case 'dashboard':
      return 'Dashboard';
    case 'row':
      return `Row ${nameOf(rows, level.id)}`;
    case 'stage':
      return `Stage ${nameOf(stages, level.id)}`;
    case 'rowGroup':
      return `Row group ${nameOf(groups(dashboard.rowGroups), level.id)}`;
    case 'columnGroup':
      return `Column group ${nameOf(groups(dashboard.columnGroups), level.id)}`;
    case 'cell':
      return `${nameOf(rows, level.rowId)} / ${nameOf(stages, level.stageId)}`;
  }
}
