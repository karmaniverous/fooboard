/**
 * Zod schema for a dashboard (spec.md §3, §4.2): rows, stages, mapping
 * settings, status colors, row and column groups and credential
 * references. Rejects, as defensive integrity checks, duplicate row,
 * stage and group ids, a source-stage cycle, and group members that are
 * unknown, in two groups or split apart (the editors prevent all of these
 * before saving).
 *
 * @module
 */
import { z } from 'zod';

import { DEFAULT_SOURCE_RULE_IDS } from '@/domain/model/builtinSources';
import { SourceRuleSchema } from '@/domain/model/sourceRule';
import {
  SourceRefsSchema,
  sourceRuleReferenceIssues,
} from '@/domain/model/sources';
import { rowSettingsIssues } from '@/domain/settings/integrity';
import { statusSetReferenceIssues } from '@/domain/statuses/resolve';

import { credentialReferenceIssues } from './credentialRefs';
import { CredentialRefSchema } from './credentials';
import { findAnyCycle } from './cycle';
import { ColumnGroupSchema, type Group, RowGroupSchema } from './groups';
import { ProviderRowRulesSchema, ProviderRulesSchema } from './placement';
import { RowSchema } from './row';
import { DashboardSettingsSchema, defaultSettings } from './settings';
import { StageSchema } from './stage';
import { StatusSetSchema } from './statusSets';

type Issue = { message: string; path: (string | number)[] };

/** Every row or stage whose id an earlier one already has: ids key cells,
 * group members, overrides and source stages, so a repeat is ambiguous. */
function duplicateIdIssues(
  items: readonly { id: string }[],
  key: 'rows' | 'stages',
  noun: string,
): Issue[] {
  const seen = new Set<string>();
  return items.flatMap(({ id }, index) => {
    const repeated = seen.has(id);
    seen.add(id);
    return repeated
      ? [{ message: `duplicate ${noun} id: ${id}`, path: [key, index, 'id'] }]
      : [];
  });
}

/** Groups on one axis must have distinct ids, and name existing items,
 * each in at most one group, in one unbroken run, so overrides and labels
 * never orphan, contradict or repeat themselves (C-14b). */
function groupIssues(
  groups: readonly Group[],
  items: readonly { id: string }[],
  key: 'rowGroups' | 'columnGroups',
  noun: string,
): Issue[] {
  const position = new Map(items.map((item, i) => [item.id, i]));
  const owner = new Map<string, string>();
  const groupIds = new Set<string>();
  return groups.flatMap((g, gi) => {
    const issues: Issue[] = [];
    if (groupIds.has(g.id))
      issues.push({
        message: `duplicate group id: ${g.id}`,
        path: [key, gi, 'id'],
      });
    groupIds.add(g.id);
    g.memberIds.forEach((id, mi) => {
      const path = [key, gi, 'memberIds', mi];
      const first = owner.get(id);
      owner.set(id, first ?? g.id);
      if (!position.has(id))
        issues.push({
          message: `group ${g.id} names unknown ${noun}: ${id}`,
          path,
        });
      else if (first !== undefined)
        issues.push({
          message: `${noun} ${id} is in groups ${first} and ${g.id}`,
          path,
        });
    });
    if (issues.length > 0) return issues;
    const at = g.memberIds.map((id) => position.get(id) ?? 0);
    const span = Math.max(...at) - Math.min(...at) + 1;
    return span === new Set(at).size
      ? []
      : [
          {
            message: `group ${g.id} is split: its ${noun}s are not together`,
            path: [key, gi, 'memberIds'],
          },
        ];
  });
}
/** A dashboard: rows, stages and the settings that derive its cells. */
export const DashboardSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    rows: z.array(RowSchema).default(() => []),
    stages: z.array(StageSchema).default(() => []),
    /** Default stage rules per source (spec.md A§4.3.7). */
    stageRules: ProviderRulesSchema.default(() => ({})),
    /** Default row-axis rules per source. */
    rowRules: ProviderRowRulesSchema.default(() => ({})),
    /** Row groups replacing dividers (spec.md C-14b). */
    rowGroups: z.array(RowGroupSchema).default(() => []),
    /** Column groups replacing dividers (spec.md C-14b). */
    columnGroups: z.array(ColumnGroupSchema).default(() => []),
    credentials: z.array(CredentialRefSchema).default(() => []),
    /** The dashboard's own status sets (customised presets), so it stays
     * self-contained for sharing and export. */
    customStatusSets: z.array(StatusSetSchema).default(() => []),
    /** The source rule per source (spec.md A§4.3.7): a built-in id or one
     * of the dashboard's own. */
    sourceRules: SourceRefsSchema.default(() => ({
      ...DEFAULT_SOURCE_RULE_IDS,
    })),
    /** The dashboard's own source rules (customised built-ins). */
    customSourceRules: z.array(SourceRuleSchema).default(() => []),
    /** The dashboard's settings (spec.md §3.11), beside requests in
     * flight per credential, per platform (spec.md §3.2). */
    settings: DashboardSettingsSchema.default(() => defaultSettings()),
  })
  .superRefine((dashboard, ctx) => {
    // Duplicate stage ids would also let a cycle hide behind a later stage
    // with the same id, so the cycle check runs only without them.
    const duplicateStages = duplicateIdIssues(
      dashboard.stages,
      'stages',
      'stage',
    );
    for (const issue of [
      ...duplicateIdIssues(dashboard.rows, 'rows', 'row'),
      ...duplicateStages,
      ...credentialReferenceIssues(dashboard),
      ...dashboard.rows.flatMap((row, index) => rowSettingsIssues(row, index)),
      ...statusSetReferenceIssues(dashboard),
      ...sourceRuleReferenceIssues(dashboard),
      ...groupIssues(dashboard.rowGroups, dashboard.rows, 'rowGroups', 'row'),
      ...groupIssues(
        dashboard.columnGroups,
        dashboard.stages,
        'columnGroups',
        'stage',
      ),
    ]) {
      ctx.addIssue({ code: 'custom', ...issue });
    }

    if (duplicateStages.length > 0) return;

    const cycle = findAnyCycle(dashboard.stages);
    if (cycle) {
      ctx.addIssue({
        code: 'custom',
        message: `source-stage cycle: ${cycle.join(' -> ')}`,
        path: ['stages'],
      });
    }
  });
export type Dashboard = z.infer<typeof DashboardSchema>;
