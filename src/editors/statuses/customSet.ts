/**
 * Editing a dashboard's own status sets (spec.md A§4.3.6): customise a
 * preset into a copy the dashboard owns, and change, reorder or remove its
 * statuses. Every change goes through `DashboardSchema` in the editor, so
 * these helpers only shape the data. Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import type { CellStatus, StatusSet } from '@/domain/config/statusSets';
import { findStatusSet } from '@/domain/statuses/resolve';

/** A fresh id: `base`, then `base-2`, `base-3`... not in `taken`. */
function freshId(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${String(n)}`)) n += 1;
  return `${base}-${String(n)}`;
}

/** A copy of set `id` the dashboard owns (not yet chosen anywhere), and
 * its id. */
export function copySet(
  dashboard: Dashboard,
  id: string,
): { dashboard: Dashboard; id: string } {
  const source = findStatusSet(id, dashboard.customStatusSets);
  if (!source) return { dashboard, id };
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
    id: copy.id,
  };
}

/** A copy of set `id` the dashboard owns, chosen for its provider, so the
 * board looks the same until it is edited. */
export function customise(dashboard: Dashboard, id: string): Dashboard {
  const copied = copySet(dashboard, id);
  const copy = copied.dashboard.customStatusSets.find(
    (s) => s.id === copied.id,
  );
  if (!copy || copied.dashboard === dashboard) return dashboard;
  return {
    ...copied.dashboard,
    statusSets: { ...dashboard.statusSets, [copy.provider]: copy.id },
  };
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
 * set's first summary status, with a test that matches nothing until it is
 * written. */
export function addCellStatus(set: StatusSet, name = 'New status'): StatusSet {
  const status: CellStatus = {
    id: freshId(
      'status',
      set.cell.map((c) => c.id),
    ),
    name,
    color: '#64748b',
    summary: set.summary[0]?.id ?? '',
    outlined: false,
    test: { not: {} },
  };
  return { ...set, cell: [status, ...set.cell] };
}

/** Move item `index` of `list` by `by` places (clamped). */
export function move<T>(list: readonly T[], index: number, by: number): T[] {
  const to = Math.max(0, Math.min(list.length - 1, index + by));
  const next = [...list];
  const [item] = next.splice(index, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}
