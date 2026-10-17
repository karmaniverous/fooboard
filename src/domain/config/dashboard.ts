/**
 * Zod schema for a dashboard (spec.md §3, §4.2): rows, stages, mapping
 * settings, status colors, dividers and credential references. Rejects a
 * source-stage cycle at parse time as a defensive integrity check (the
 * stage editor is expected to prevent cycles before they are saved).
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
import { ColumnGroupSchema, RowGroupSchema } from './groups';
import { MappingSettingsSchema } from './mappingSettings';
import { RowSchema } from './row';
import { StageSchema } from './stage';

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
    for (const issue of credentialReferenceIssues(dashboard)) {
      ctx.addIssue({ code: 'custom', ...issue });
    }

    // Group member ids must name rows/stages that actually exist, so
    // overrides and labels never orphan themselves silently.
    const rowIds = new Set(dashboard.rows.map((r) => r.id));
    dashboard.rowGroups.forEach((g, gi) => {
      g.memberIds.forEach((id, mi) => {
        if (!rowIds.has(id)) {
          ctx.addIssue({
            code: 'custom',
            message: `row group ${g.id} names unknown row: ${id}`,
            path: ['rowGroups', gi, 'memberIds', mi],
          });
        }
      });
    });
    const stageIds = new Set(dashboard.stages.map((s) => s.id));
    dashboard.columnGroups.forEach((g, gi) => {
      g.memberIds.forEach((id, mi) => {
        if (!stageIds.has(id)) {
          ctx.addIssue({
            code: 'custom',
            message: `column group ${g.id} names unknown stage: ${id}`,
            path: ['columnGroups', gi, 'memberIds', mi],
          });
        }
      });
    });

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
