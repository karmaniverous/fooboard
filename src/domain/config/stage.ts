/**
 * Zod schema for dashboard stages (spec.md §3): a deployment target with a
 * branch pattern and at most one source stage. Many stages may share a
 * source.
 *
 * @module
 */
import { z } from 'zod';

import { SettingsSchema } from '@/domain/settings/schema';

import { ProviderRulesSchema } from './placement';

/** A deployment target: its stage rules per source (spec.md A§4.3.7;
 * optional, the column group's or dashboard's apply otherwise), an
 * optional source stage, and the column's settings (spec.md §3.11). */
export const StageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  rules: ProviderRulesSchema.default(() => ({})),
  sourceStageId: z.string().min(1).optional(),
  settings: SettingsSchema.default(() => ({})),
});
export type Stage = z.infer<typeof StageSchema>;
