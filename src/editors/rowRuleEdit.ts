/**
 * Row-rule editing (spec.md A§4.3.7): a row group's or the dashboard's
 * record rule for one source; `undefined` unsets it. (Item rules are
 * settings, spec.md §3.11.) Pure.
 *
 * @module
 */
import type { z } from 'zod';

import type { Dashboard } from '@/domain/config/dashboard';
import type { ProviderRowRulesSchema } from '@/domain/config/placement';
import type { Provider } from '@/domain/config/providers';
import type { Rule } from '@/domain/rules/schema';

type ProviderRowRules = z.infer<typeof ProviderRowRulesSchema>;

const withRule = (
  rules: ProviderRowRules,
  provider: Provider,
  rule: Rule | undefined,
): ProviderRowRules => ({
  ...rules,
  [provider]: rule === undefined ? undefined : { record: rule },
});

export const setGroupRowRule = (
  d: Dashboard,
  groupId: string,
  provider: Provider,
  rule: Rule | undefined,
): Dashboard => ({
  ...d,
  rowGroups: d.rowGroups.map((g) =>
    g.id === groupId
      ? { ...g, rowRules: withRule(g.rowRules, provider, rule) }
      : g,
  ),
});

export const setDashboardRowRule = (
  d: Dashboard,
  provider: Provider,
  rule: Rule | undefined,
): Dashboard => ({
  ...d,
  rowRules: withRule(d.rowRules, provider, rule),
});
