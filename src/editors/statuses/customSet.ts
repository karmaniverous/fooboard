/**
 * Editing a dashboard's own status sets (spec.md A§4.3.6): customise a
 * preset into a copy the dashboard owns, and change, reorder or remove its
 * statuses. Every change goes through `DashboardSchema` in the editor, so
 * these helpers only shape the data. Pure.
 *
 * @module
 */
import { STATUS_COLORS } from '@/domain/config/colors';
import type { Dashboard } from '@/domain/config/dashboard';
import type { CellStatus, StatusSet } from '@/domain/config/statusSets';
import { never } from '@/domain/model/ruleBuilders';
import { findStatusSet } from '@/domain/statuses/resolve';
import { freshId } from '@/lib/ids';

import { setDashboardStatusSet } from './overrideSets';

/** The dashboard with a copy of set `id` it owns (not yet chosen
 * anywhere), and the copy; `undefined` for an unknown set. */
export function copySet(
  dashboard: Dashboard,
  id: string,
): { dashboard: Dashboard; copy: StatusSet } | undefined {
  const source = findStatusSet(id, dashboard.customStatusSets);
  if (!source) return undefined;
  const copy: StatusSet = {
    ...structuredClone(source),
    id: freshId(
      `custom-${source.provider}`,
      dashboard.customStatusSets.map((s) => s.id),
    ),
    name: `${source.name} (custom)`,
  };
  return {
    dashboard: {
      ...dashboard,
      customStatusSets: [...dashboard.customStatusSets, copy],
    },
    copy,
  };
}

/** A copy of set `id` the dashboard owns, chosen for its provider, so the
 * board looks the same until it is edited. */
export function customise(dashboard: Dashboard, id: string): Dashboard {
  const copied = copySet(dashboard, id);
  return copied
    ? setDashboardStatusSet(
        copied.dashboard,
        copied.copy.provider,
        copied.copy.id,
      )
    : dashboard;
}

/** `dashboard` with its own set `id` replaced by `change(set)`. */
export function updateSet(
  dashboard: Dashboard,
  id: string,
  change: (set: StatusSet) => StatusSet,
): Dashboard {
  return {
    ...dashboard,
    customStatusSets: dashboard.customStatusSets.map((s) =>
      s.id === id ? change(s) : s,
    ),
  };
}

/** Is the dashboard's own set `id` chosen anywhere? A set in use can't be
 * removed (its references would dangle). */
export function setInUse(dashboard: Dashboard, id: string): boolean {
  return (
    Object.values(dashboard.statusSets).includes(id) ||
    dashboard.rowGroups.some((g) => Object.values(g.statusSets).includes(id)) ||
    dashboard.rows.some(
      (r) => r.statusSet === id || Object.values(r.cellStatusSets).includes(id),
    )
  );
}

export function removeSet(dashboard: Dashboard, id: string): Dashboard {
  return {
    ...dashboard,
    customStatusSets: dashboard.customStatusSets.filter((s) => s.id !== id),
  };
}

/** A new cell status at the top (first match wins), counting toward the
 * set's first summary status, with a rule that matches nothing until it is
 * written. */
export function addCellStatus(set: StatusSet, name = 'New status'): StatusSet {
  const status: CellStatus = {
    id: freshId(
      'status',
      set.cell.map((c) => c.id),
    ),
    name,
    color: STATUS_COLORS.added,
    summary: set.summary[0]?.id ?? '',
    outlined: false,
    rule: never,
  };
  return { ...set, cell: [status, ...set.cell] };
}
