/**
 * Zod schema for a dashboard (spec.md §3, §4.2): rows, stages, mapping
 * settings, status colors, row and column groups and credential
 * references. Rejects, as defensive integrity checks, a source-stage
 * cycle, duplicate group ids, and group members that are unknown, in two
 * groups or split apart (the editors prevent all of these before saving).
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
import { statusSetReferenceIssues } from '@/domain/statuses/resolve';

import {
  credentialReferenceIssues,
  DefaultCredentialsSchema,
} from './credentialRefs';
import { CredentialRefSchema } from './credentials';
import { findAnyCycle } from './cycle';
import { ColumnGroupSchema, type Group, RowGroupSchema } from './groups';
import { ProviderRowRulesSchema, ProviderRulesSchema } from './placement';
import { RowSchema } from './row';
import { StageSchema } from './stage';
import {
  DashboardStatusSetsSchema,
  DEFAULT_STATUS_SET_IDS,
  StatusSetSchema,
} from './statusSets';

/** Groups on one axis must have distinct ids, and name existing items,
 * each in at most one group, in one unbroken run, so overrides and labels
 * never orphan, contradict or repeat themselves (C-14b). */
function groupIssues(
  groups: readonly Group[],
  items: readonly { id: string }[],
  key: 'rowGroups' | 'columnGroups',
  noun: string,
): { message: string; path: (string | number)[] }[] {
  const position = new Map(items.map((item, i) => [item.id, i]));
  const owner = new Map<string, string>();
  const groupIds = new Set<string>();
  return groups.flatMap((g, gi) => {
    const issues: { message: string; path: (string | number)[] }[] = [];
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
    /** Default GitHub token and AWS key; rows and sources may override. */
    defaultCredentials: DefaultCredentialsSchema.default(() => ({})),
    /** The status set per provider (A§4.3.6); levels below may override. */
    statusSets: DashboardStatusSetsSchema.default(() => ({
      ...DEFAULT_STATUS_SET_IDS,
    })),
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
  })
  .superRefine((dashboard, ctx) => {
    for (const issue of [
      ...credentialReferenceIssues(dashboard),
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

    // Duplicate ids make source references ambiguous and would let a cycle
    // hide behind a later stage with the same id, so reject them first.
    const seen = new Set<string>();
    const duplicates = dashboard.stages.flatMap((stage, index) => {
      const isDuplicate = seen.has(stage.id);
      seen.add(stage.id);
      return isDuplicate ? [{ id: stage.id, index }] : [];
    });
    for (const { id, index } of duplicates) {
      ctx.addIssue({
        code: 'custom',
        message: `duplicate stage id: ${id}`,
        path: ['stages', index, 'id'],
      });
    }
    if (duplicates.length > 0) return;

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
