/**
 * Configuration shapes of schema v2 that v3 replaced with status sets
 * (spec.md A§4.3.6): the phase tests and the status colours. Kept only to
 * migrate v2 data and as the frozen reference for the bundled presets.
 *
 * @module
 */
import { z } from 'zod';

import { HexColorSchema } from './colors';
import { JobNameTestSchema } from './matchTest';

/** Default status fill colors (spec.md §3 table), editable per dashboard. */
export const DEFAULT_STATUS_COLORS = {
  queued: '#e2e8f0',
  started: '#2563eb',
  partialSuccess: '#0e7490',
  success: '#15803d',
  failure: '#dc2626',
  cancelled: '#475569',
} as const;

/** Default phase test for `deploy`: job name contains "deploy". */
const DEFAULT_DEPLOY_PHASE_TESTS = [
  { field: 'jobName', operator: 'contains', value: 'deploy' },
] as const;

/** Default phase test for `test`: job name contains "test". */
const DEFAULT_TEST_PHASE_TESTS = [
  { field: 'jobName', operator: 'contains', value: 'test' },
] as const;

/** Fresh copies of the default tests. Zod defaults skip inner parsing, so
 * returning the constants' own objects would share them across dashboards. */
const fresh = <T extends object>(tests: readonly T[]): T[] =>
  tests.map((t) => ({ ...t }));

/**
 * Phase tests on job name, OR'd within each phase. Phase order is fixed
 * (`deploy`, then `test`); a job matching both tests counts as `test`.
 */
export const PhaseTestsSchema = z.object({
  deploy: z
    .array(JobNameTestSchema)
    .default(() => fresh(DEFAULT_DEPLOY_PHASE_TESTS)),
  test: z
    .array(JobNameTestSchema)
    .default(() => fresh(DEFAULT_TEST_PHASE_TESTS)),
});
export type PhaseTests = z.infer<typeof PhaseTestsSchema>;

/** Editable status fill colors, one hex color per status (spec.md §3). */
export const StatusColorsSchema = z.object({
  queued: HexColorSchema.default(DEFAULT_STATUS_COLORS.queued),
  started: HexColorSchema.default(DEFAULT_STATUS_COLORS.started),
  partialSuccess: HexColorSchema.default(DEFAULT_STATUS_COLORS.partialSuccess),
  success: HexColorSchema.default(DEFAULT_STATUS_COLORS.success),
  failure: HexColorSchema.default(DEFAULT_STATUS_COLORS.failure),
  cancelled: HexColorSchema.default(DEFAULT_STATUS_COLORS.cancelled),
});
