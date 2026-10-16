/**
 * Zod schema for dashboard stages (spec.md §3): a deployment target with a
 * branch pattern and at most one source stage. Many stages may share a
 * source.
 *
 * @module
 */
import { z } from 'zod';

/** A deployment target: branch pattern plus optional source stage. */
export const StageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  branchPattern: z.string().min(1),
  sourceStageId: z.string().min(1).optional(),
});
export type Stage = z.infer<typeof StageSchema>;
