/**
 * Small builders for status tests (spec.md A§4.3.6), shared by the bundled
 * presets, the v3 migration and the editor's form, so every test fooboard
 * writes is plain JSON Schema of the same few shapes.
 *
 * @module
 */
import type { MatchTest } from '@/domain/config/matchTest';

import { textPattern } from './pattern';

export type JsonSchema = Record<string, unknown>;

/** An object whose `property` is present and passes `test`. */
export const has = (property: string, test: JsonSchema): JsonSchema => ({
  type: 'object',
  properties: { [property]: test },
  required: [property],
});

/** A property is one of `values` (`null` allowed). */
export const oneOf = (
  property: string,
  values: readonly (string | null)[],
): JsonSchema => has(property, { enum: [...values] });

/** The job's name passes any of `tests` (OR'd, as match tests are). */
export const nameMatches = (tests: readonly MatchTest[]): JsonSchema => ({
  type: 'object',
  properties: {
    name: {
      type: 'string',
      anyOf: tests.map((t) => ({
        pattern: textPattern(t.operator, t.value),
      })),
    },
  },
  required: ['name'],
});

/** Every one of `parts` holds (none: anything does). */
export const all = (...parts: JsonSchema[]): JsonSchema => {
  if (parts.length === 0) return {};
  return parts.length === 1 && parts[0] ? parts[0] : { allOf: parts };
};

/** Not `part`. */
export const not = (part: JsonSchema): JsonSchema => ({ not: part });

/** Some job of the run passes `job`. */
export const anyJob = (job: JsonSchema): JsonSchema =>
  has('jobs', { type: 'array', contains: job });

/** Every job of the run passes `job` (and there is at least one). */
export const everyJob = (job: JsonSchema): JsonSchema =>
  has('jobs', { type: 'array', minItems: 1, items: job });

/** GitHub job conclusions that count as failed (as today, A§4.3.3). */
export const FAILED = ['failure', 'timed_out', 'startup_failure'] as const;

/** A GitHub job still waiting to run (statuses and the approval wait). */
export const waiting: JsonSchema = {
  anyOf: [
    oneOf('status', ['queued', 'waiting', 'pending', 'requested']),
    oneOf('conclusion', ['action_required']),
  ],
};

/** A GitHub job running now. */
export const running: JsonSchema = all(
  oneOf('status', ['in_progress']),
  oneOf('conclusion', [null]),
);
