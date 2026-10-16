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
import { DividerSchema } from './dividers';
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
    rowDividers: z.array(DividerSchema).default(() => []),
    columnDividers: z.array(DividerSchema).default(() => []),
    credentials: z.array(CredentialRefSchema).default(() => []),
    /** Default GitHub token and AWS key; rows and sources may override. */
    defaultCredentials: DefaultCredentialsSchema.default(() => ({})),
  })
  .superRefine((dashboard, ctx) => {
    for (const issue of credentialReferenceIssues(dashboard)) {
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
