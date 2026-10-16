/**
 * Zod schema for match tests (spec.md §3): `field · operator · value`, with
 * operators `is`, `startsWith`, `endsWith`, `contains` and `regex`. Used for
 * row key tests, workflow filters and phase tests. Shared by the config
 * schema and the matching primitives.
 *
 * @module
 */
import { z } from 'zod';

/** Field a match test is evaluated against. */
export const MatchFieldSchema = z.enum(['jobName', 'workflowName']);
export type MatchField = z.infer<typeof MatchFieldSchema>;

/** Comparison operator for a match test (spec.md §3). */
export const MatchOperatorSchema = z.enum([
  'is',
  'startsWith',
  'endsWith',
  'contains',
  'regex',
]);
export type MatchOperator = z.infer<typeof MatchOperatorSchema>;

const testOn = <F extends z.ZodType<MatchField>>(field: F) =>
  z.object({
    field,
    operator: MatchOperatorSchema,
    value: z.string().min(1),
  });

/**
 * One `field · operator · value` test on either field (row key tests). A
 * list of tests on one item is OR'd together.
 */
export const MatchTestSchema = testOn(MatchFieldSchema);
export type MatchTest = z.infer<typeof MatchTestSchema>;

/** A test on job name only (phase tests: the evaluator has no workflow
 * name in that context, so a workflow-name test could never match). */
export const JobNameTestSchema = testOn(z.literal('jobName'));

/** A test on workflow name only (workflow filters: there is no single job
 * name at that point). */
export const WorkflowNameTestSchema = testOn(z.literal('workflowName'));
