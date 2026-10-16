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

import { MatchTestSchema } from './matchTest';

/** Default phase test for `deploy`: job name contains "deploy". */
export const DEFAULT_DEPLOY_PHASE_TESTS = [
  { field: 'jobName', operator: 'contains', value: 'deploy' },
] as const;

/** Default phase test for `test`: job name contains "test". */
export const DEFAULT_TEST_PHASE_TESTS = [
  { field: 'jobName', operator: 'contains', value: 'test' },
] as const;

/**
 * Phase tests on job name, OR'd within each phase. Phase order is fixed
 * (`deploy`, then `test`); a job matching both tests counts as `test`.
 */
export const PhaseTestsSchema = z.object({
  deploy: z
    .array(MatchTestSchema)
    .default(() => [...DEFAULT_DEPLOY_PHASE_TESTS]),
  test: z.array(MatchTestSchema).default(() => [...DEFAULT_TEST_PHASE_TESTS]),
});
export type PhaseTests = z.infer<typeof PhaseTestsSchema>;

/**
 * Workflow-name include/exclude filter. An empty `include` list means
 * "include all"; an empty `exclude` list excludes nothing.
 */
export const WorkflowFilterSchema = z.object({
  include: z.array(MatchTestSchema).default(() => []),
  exclude: z.array(MatchTestSchema).default(() => []),
});
export type WorkflowFilter = z.infer<typeof WorkflowFilterSchema>;

/** Dashboard-level mapping settings (spec.md §4.3.1), with defaults. */
export const MappingSettingsSchema = z.object({
  phases: PhaseTestsSchema.default(() => ({
    deploy: [...DEFAULT_DEPLOY_PHASE_TESTS],
    test: [...DEFAULT_TEST_PHASE_TESTS],
  })),
  workflowFilter: WorkflowFilterSchema.default(() => ({
    include: [],
    exclude: [],
  })),
});
export type MappingSettings = z.infer<typeof MappingSettingsSchema>;
