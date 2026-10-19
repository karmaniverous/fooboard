/**
 * Source-rule editing (spec.md A§4.3.7): choose a source rule per source,
 * *Customise* a built-in into one the dashboard owns (chosen in its
 * place, so the board looks the same until it is edited), change or
 * remove a custom one. Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import type { SourceRule } from '@/domain/model/sourceRule';
import { findSourceRule } from '@/domain/model/sources';

type Provider = SourceRule['provider'];

/** `base`, or `base-2`, `base-3`... whichever `taken` lacks. */
function freshId(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}-${String(n)}`)) n++;
  return `${base}-${String(n)}`;
}

/** Choose source rule `id` for `provider`. */
export const chooseSource = (
  dashboard: Dashboard,
  provider: Provider,
  id: string,
): Dashboard => ({
  ...dashboard,
  sourceRules: { ...dashboard.sourceRules, [provider]: id },
});

/** A copy of source rule `id` the dashboard owns, chosen for its
 * provider. */
export function customiseSource(dashboard: Dashboard, id: string): Dashboard {
  const rule = findSourceRule(id, dashboard.customSourceRules);
  if (!rule) return dashboard;
  const copy: SourceRule = {
    ...structuredClone(rule),
    id: freshId(
      `custom-${rule.provider}`,
      dashboard.customSourceRules.map((s) => s.id),
    ),
    name: `${rule.name} (custom)`,
  };
  return chooseSource(
    { ...dashboard, customSourceRules: [...dashboard.customSourceRules, copy] },
    copy.provider,
    copy.id,
  );
}

/** The dashboard with custom source rule `next` replacing its namesake. */
export const updateSource = (
  dashboard: Dashboard,
  next: SourceRule,
): Dashboard => ({
  ...dashboard,
  customSourceRules: dashboard.customSourceRules.map((s) =>
    s.id === next.id ? next : s,
  ),
});

/** Is source rule `id` chosen for any source? */
export const sourceInUse = (dashboard: Dashboard, id: string): boolean =>
  Object.values(dashboard.sourceRules).includes(id);

/** The dashboard without custom source rule `id` (callers check it is not
 * in use). */
export const removeSource = (dashboard: Dashboard, id: string): Dashboard => ({
  ...dashboard,
  customSourceRules: dashboard.customSourceRules.filter((s) => s.id !== id),
});
