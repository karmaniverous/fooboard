/**
 * Zod schema for dashboard-level mapping settings (spec.md §4.3.1): phase
 * tests on job name, and a workflow-name include/exclude filter. The
 * `pull_request` / `pull_request_target` event exclusion is fixed behaviour
 * applied by the derivation and provider layers, not a per-dashboard
 * setting, so it has no field here.
 *
 * @module
 */
import { z } from 'zod';

import { WorkflowNameTestSchema } from './matchTest';

/**
 * Workflow-name include/exclude filter. An empty `include` list means
 * "include all"; an empty `exclude` list excludes nothing.
 */
export const WorkflowFilterSchema = z.object({
  include: z.array(WorkflowNameTestSchema).default(() => []),
  exclude: z.array(WorkflowNameTestSchema).default(() => []),
});
export type WorkflowFilter = z.infer<typeof WorkflowFilterSchema>;

/** Dashboard-level mapping settings (spec.md §4.3.1), with defaults. */
export const MappingSettingsSchema = z.object({
  workflowFilter: WorkflowFilterSchema.default(() => ({
    include: [],
    exclude: [],
  })),
});
export type MappingSettings = z.infer<typeof MappingSettingsSchema>;
