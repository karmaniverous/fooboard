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

/**
 * One `field · operator · value` test. A list of tests on one item (row key
 * tests, workflow include/exclude, phase tests) is OR'd together.
 */
export const MatchTestSchema = z.object({
  field: MatchFieldSchema,
  operator: MatchOperatorSchema,
  value: z.string().min(1),
});
export type MatchTest = z.infer<typeof MatchTestSchema>;
