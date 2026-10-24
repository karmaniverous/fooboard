/**
 * Override editing (spec.md C-14c, A§4.3.7, C-1a): stage-rule overrides on
 * a row or a row group (written from a branch pattern, or as a rule), and
 * a row group's default credentials. Pure.
 *
 * @module
 */
import { omit } from 'radash';

import type { Dashboard } from '@/domain/config/dashboard';
import type { RowGroup } from '@/domain/config/groups';
import { ownOverride } from '@/domain/config/ownOverride';
import { branchRules, type ProviderRules } from '@/domain/config/placement';
import type { Provider } from '@/domain/config/providers';
import { unlessAlways } from '@/domain/rules/always';
import { branchOf, branchRule } from '@/domain/rules/branch';
import type { Rule } from '@/domain/rules/schema';
import { countSet } from '@/domain/settings/schema';

/** `overrides` with `stageId` set to `value`, or cleared by `undefined`. */
function withOverride<T>(
  overrides: Readonly<Record<string, T>>,
  stageId: string,
  value: T | undefined,
): Record<string, T> {
  const rest = omit(overrides, [stageId]);
  return value === undefined ? rest : { ...rest, [stageId]: value };
}

/** `d` with one row group changed. */
const updateRowGroup = (
  d: Dashboard,
  groupId: string,
  change: (g: RowGroup) => RowGroup,
): Dashboard => ({
  ...d,
  rowGroups: d.rowGroups.map((g) => (g.id === groupId ? change(g) : g)),
});

/** A row's own stage-rule override, as a general rule (cleared with
 * `undefined` or an empty rule). */
export const setRowStageRule = (
  d: Dashboard,
  rowId: string,
  stageId: string,
  rule: Rule | undefined,
): Dashboard => writeRowStageRule(d, rowId, stageId, unlessAlways(rule));

const writeRowStageRule = (
  d: Dashboard,
  rowId: string,
  stageId: string,
  rule: Rule | undefined,
): Dashboard => ({
  ...d,
  rows: d.rows.map((r) =>
    r.id === rowId
      ? { ...r, stageRules: withOverride(r.stageRules, stageId, rule) }
      : r,
  ),
});

/** A row group's stage-rule overrides for a stage (cleared with
 * `undefined`). */
const setRowGroupStageRules = (
  d: Dashboard,
  groupId: string,
  stageId: string,
  rules: ProviderRules | undefined,
): Dashboard =>
  updateRowGroup(d, groupId, (g) => ({
    ...g,
    stageRules: withOverride(g.stageRules, stageId, rules),
  }));

/** A row's override from a branch pattern; empty clears it. */
export const setRowOverride = (
  d: Dashboard,
  rowId: string,
  stageId: string,
  pattern: string,
): Dashboard => {
  const text = pattern.trim();
  return writeRowStageRule(
    d,
    rowId,
    stageId,
    text ? branchRule(text) : undefined,
  );
};

/** A row group's override from a branch pattern; empty clears it. */
export const setRowGroupOverride = (
  d: Dashboard,
  groupId: string,
  stageId: string,
  pattern: string,
): Dashboard => {
  const text = pattern.trim();
  return setRowGroupStageRules(
    d,
    groupId,
    stageId,
    text ? branchRules(text) : undefined,
  );
};

/** One source's rule in a row group's stage-rule override, as a general
 * rule (an empty rule clears that source; no source left clears the
 * override). */
export const setRowGroupStageRule = (
  d: Dashboard,
  groupId: string,
  stageId: string,
  provider: Provider,
  rule: Rule | undefined,
): Dashboard => {
  const group = d.rowGroups.find((g) => g.id === groupId);
  const current = group ? ownOverride(group.stageRules, stageId) : undefined;
  const kept = unlessAlways(rule);
  const next: ProviderRules = {
    ...omit(current ?? {}, [provider]),
    ...(kept && { [provider]: kept }),
  };
  return setRowGroupStageRules(
    d,
    groupId,
    stageId,
    Object.keys(next).length > 0 ? next : undefined,
  );
};

/** The branch pattern a row's override for `stageId` is, if it is one
 * (`''` when there's no override). */
export const rowOverridePattern = (
  row: { stageRules: Record<string, Rule> },
  stageId: string,
): string | undefined => {
  const rule = ownOverride(row.stageRules, stageId);
  return rule === undefined ? '' : branchOf(rule);
};

/** The branch pattern a row group's override for `stageId` is, if every
 * source's is the same one (`''` when there's no override). */
export const groupOverridePattern = (
  group: Pick<RowGroup, 'stageRules'>,
  stageId: string,
): string | undefined => {
  const rules = ownOverride(group.stageRules, stageId);
  if (rules === undefined) return '';
  const github = branchOf(rules.github);
  return github !== undefined && github === branchOf(rules.amplify)
    ? github
    : undefined;
};

/** Does a row group carry settings that are lost when it disappears? */
export const carriesSettings = (g: RowGroup): boolean =>
  Object.keys(g.stageRules).length > 0 ||
  Object.keys(g.rowRules).length > 0 ||
  countSet(g.settings) > 0;
