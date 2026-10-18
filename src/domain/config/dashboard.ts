/**
 * Zod schema for a dashboard (spec.md §3, §4.2): rows, stages, mapping
 * settings, status colors, row and column groups and credential
 * references. Rejects, as defensive integrity checks, a source-stage
 * cycle and group members that are unknown or in two groups (the editors
 * prevent both before saving).
 *
 * @module
 */
import { z } from 'zod';

import { StatusColorsSchema } from './colors';
import {
  credentialReferenceIssues,
  DefaultCredentialsSchema,
} from './credentialRefs';
import { CredentialRefSchema } from './credentials';
import { findAnyCycle } from './cycle';
import { ColumnGroupSchema, type Group, RowGroupSchema } from './groups';
import { MappingSettingsSchema } from './mappingSettings';
import { RowSchema } from './row';
import { StageSchema } from './stage';

/** Group members must name existing items, each in at most one group,
 * so overrides and labels never orphan or contradict themselves (C-14b). */
function groupIssues(
  groups: readonly Group[],
  items: readonly { id: string }[],
  key: 'rowGroups' | 'columnGroups',
  noun: string,
): { message: string; path: (string | number)[] }[] {
  const known = new Set(items.map((i) => i.id));
  const owner = new Map<string, string>();
  return groups.flatMap((g, gi) =>
    g.memberIds.flatMap((id, mi) => {
      const path = [key, gi, 'memberIds', mi];
      const first = owner.get(id);
      owner.set(id, first ?? g.id);
      if (!known.has(id)) {
        return [
          { message: `group ${g.id} names unknown ${noun}: ${id}`, path },
        ];
      }
      return first === undefined
        ? []
        : [
            {
              message: `${noun} ${id} is in groups ${first} and ${g.id}`,
              path,
            },
          ];
    }),
  );
}

/** A dashboard: rows, stages and the settings that derive its cells. */
export const DashboardSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    rows: z.array(RowSchema).default(() => []),
    stages: z.array(StageSchema).default(() => []),
    mapping: MappingSettingsSchema.default(() =>
      MappingSettingsSchema.parse({}),
    ),
    statusColors: StatusColorsSchema.default(() =>
      StatusColorsSchema.parse({}),
    ),
    /** Row groups replacing dividers (spec.md C-14b). */
    rowGroups: z.array(RowGroupSchema).default(() => []),
    /** Column groups replacing dividers (spec.md C-14b). */
    columnGroups: z.array(ColumnGroupSchema).default(() => []),
    credentials: z.array(CredentialRefSchema).default(() => []),
    /** Default GitHub token and AWS key; rows and sources may override. */
    defaultCredentials: DefaultCredentialsSchema.default(() => ({})),
  })
  .superRefine((dashboard, ctx) => {
    for (const issue of [
      ...credentialReferenceIssues(dashboard),
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
