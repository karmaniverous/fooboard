/**
 * Zod schema for dashboard stages (spec.md §3): a deployment target with a
 * branch pattern and at most one source stage. Many stages may share a
 * source.
 *
 * @module
 */
import { z } from 'zod';

import { ProviderRulesSchema } from './placement';

/** A deployment target: its stage rules per source (spec.md A§4.3.7;
 * optional, the column group's or dashboard's apply otherwise) and an
 * optional source stage. */
export const StageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  rules: ProviderRulesSchema.default(() => ({})),
  sourceStageId: z.string().min(1).optional(),
});
export type Stage = z.infer<typeof StageSchema>;
