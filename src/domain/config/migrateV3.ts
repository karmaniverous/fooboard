/**
 * Config migration v2 to v3 (spec.md A§4.3.6): phase tests and status
 * colours give way to status sets. A dashboard on the default phase tests
 * and colours uses the bundled presets; one with either edited gets its
 * own sets built from them (the deploy-and-test rules over its phase
 * tests, every status in the colour of the status it replaces), so its
 * board looks the same after upgrading.
 *
 * @module
 */
import { isEqual, omit } from 'radash';
import { z } from 'zod';

import {
  deployTestJobs,
  deployTestStatuses,
  PRESET_SUMMARY,
  presetById,
  PRESETS,
} from '@/domain/statuses/presets';

import {
  DEFAULT_STATUS_COLORS,
  PhaseTestsSchema,
  StatusColorsSchema,
} from './legacyV2';
import type { StatusSet } from './statusSets';

type LegacyColor = keyof typeof DEFAULT_STATUS_COLORS;

/** The old status each new status (cell or summary, by id) stands for. */
const LEGACY: Partial<Record<string, LegacyColor>> = {
  testFailed: 'failure',
  deployFailed: 'failure',
  failed: 'failure',
  failing: 'failure',
  cancelled: 'cancelled',
  testing: 'started',
  deploying: 'started',
  running: 'started',
  passed: 'success',
  deployed: 'success',
  ok: 'success',
  partial: 'partialSuccess',
  queued: 'queued',
};

/** `set` with every status in its old status's colour. */
function recolored(
  set: StatusSet,
  colors: Record<LegacyColor, string>,
): StatusSet {
  const color = <T extends { id: string; color: string }>(s: T): T => {
    const legacy = LEGACY[s.id];
    return legacy ? { ...s, color: colors[legacy] } : s;
  };
  return {
    ...set,
    summary: set.summary.map(color),
    cell: set.cell.map(color),
  };
}

const V2DashboardSchema = z.looseObject({
  mapping: z
    .looseObject({
      phases: PhaseTestsSchema.default(() => PhaseTestsSchema.parse({})),
    })
    .default(() => ({ phases: PhaseTestsSchema.parse({}) })),
  statusColors: StatusColorsSchema.default(() => StatusColorsSchema.parse({})),
});

/** v2 to v3 for one dashboard. Invalid data is passed through for the v3
 * schema to reject. */
export function phasesToStatusSets(input: unknown): unknown {
  const parsed = V2DashboardSchema.safeParse(input);
  if (!parsed.success) return input;
  const { mapping, statusColors } = parsed.data;
  const rest = {
    ...omit(parsed.data, ['statusColors']),
    mapping: omit(mapping, ['phases']),
  };
  const defaultPhases = isEqual(mapping.phases, PhaseTestsSchema.parse({}));
  const defaultColors = isEqual(statusColors, { ...DEFAULT_STATUS_COLORS });
  if (defaultPhases && defaultColors) return rest;

  const { deploy, test } = mapping.phases;
  const github: StatusSet = recolored(
    {
      ...presetById('github-deploy-test'),
      id: 'custom-github',
      name: 'Deploy and test (upgraded)',
      jobs: deployTestJobs(deploy, test),
      summary: PRESET_SUMMARY,
      cell: deployTestStatuses(deploy, test),
    },
    statusColors,
  );
  const amplify: StatusSet = defaultColors
    ? presetById('amplify')
    : recolored(
        {
          ...presetById('amplify'),
          id: 'custom-amplify',
          name: 'Amplify (upgraded)',
        },
        statusColors,
      );
  return {
    ...rest,
    statusSets: { github: github.id, amplify: amplify.id },
    customStatusSets: [github, amplify].filter((s) => !PRESETS.includes(s)),
  };
}
