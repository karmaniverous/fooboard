/**
 * Placement rules (spec.md A§4.3.7): which records belong in a cell. The
 * row axis (dashboard, row group, row) gives a record rule and an item
 * rule; the column axis (dashboard, column group, stage) a stage rule,
 * overridable for a stage on a row group or a row. On each axis the most
 * specific level that sets a rule wins outright. Rules are keyed by source
 * where several sources meet; a row has one source. Pure.
 *
 * @module
 */
import { z } from 'zod';

import { branchRule } from '@/domain/rules/branch';
import { type Rule, RuleSchema } from '@/domain/rules/schema';

import { ownOverride } from './ownOverride';

/** A rule per source, at a level several sources share. */
export const ProviderRulesSchema = z.object({
  github: RuleSchema.optional(),
  amplify: RuleSchema.optional(),
});
export type ProviderRules = z.infer<typeof ProviderRulesSchema>;

/** A row group's stage-rule overrides, by stage id and source. */
export const GroupStageRulesSchema = z.record(
  z.string().min(1),
  ProviderRulesSchema,
);

/** A row's stage-rule overrides, by stage id. */
export const RowStageRulesSchema = z.record(z.string().min(1), RuleSchema);

/** The row axis's rules at one level, for one source. */
const RowRulesSchema = z.object({
  record: RuleSchema.optional(),
  items: RuleSchema.optional(),
});

/** The row axis's rules per source, at a level several sources share. */
export const ProviderRowRulesSchema = z.object({
  github: RowRulesSchema.optional(),
  amplify: RowRulesSchema.optional(),
});

/** The stage rules a branch pattern gives every source (the branch
 * presets and the editors' *Branch* field). */
export const branchRules = (pattern: string): ProviderRules => ({
  github: branchRule(pattern),
  amplify: branchRule(pattern),
});

type Provider = keyof ProviderRules;

const ALWAYS: Rule = { combine: 'and', checks: [] };

interface PlacementScope {
  stageRules: ProviderRules;
  rowRules: z.infer<typeof ProviderRowRulesSchema>;
  stages: readonly { id: string; rules: ProviderRules }[];
  columnGroups: readonly { memberIds: string[]; stageRules: ProviderRules }[];
  rowGroups: readonly {
    memberIds: string[];
    stageRules: z.infer<typeof GroupStageRulesSchema>;
    rowRules: z.infer<typeof ProviderRowRulesSchema>;
  }[];
}

interface PlacedRow {
  id: string;
  type: Provider;
  stageRules: Record<string, Rule>;
  recordRule?: Rule;
  itemRule?: Rule;
}

/** The stage rule for `row`'s cell in `stageId`, or `undefined` when no
 * level sets one (the cell matches nothing). */
export function stageRuleFor(
  scope: PlacementScope,
  row: PlacedRow,
  stageId: string,
): Rule | undefined {
  const p = row.type;
  const group = scope.rowGroups.find((g) => g.memberIds.includes(row.id));
  const columnGroup = scope.columnGroups.find((g) =>
    g.memberIds.includes(stageId),
  );
  return (
    ownOverride(row.stageRules, stageId) ??
    (group ? ownOverride(group.stageRules, stageId)?.[p] : undefined) ??
    scope.stages.find((s) => s.id === stageId)?.rules[p] ??
    columnGroup?.stageRules[p] ??
    scope.stageRules[p]
  );
}

/** `row`'s record and item rules; unset at every level, everything
 * matches (a row reads only its own repo or app). */
export function rowRulesFor(
  scope: PlacementScope,
  row: PlacedRow,
): { record: Rule; items: Rule } {
  const p = row.type;
  const group = scope.rowGroups.find((g) => g.memberIds.includes(row.id));
  return {
    record:
      row.recordRule ??
      group?.rowRules[p]?.record ??
      scope.rowRules[p]?.record ??
      ALWAYS,
    items:
      row.itemRule ??
      group?.rowRules[p]?.items ??
      scope.rowRules[p]?.items ??
      ALWAYS,
  };
}
