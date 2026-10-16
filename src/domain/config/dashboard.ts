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
  })
  .superRefine((dashboard, ctx) => {
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
