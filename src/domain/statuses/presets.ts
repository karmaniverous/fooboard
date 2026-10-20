/**
 * The bundled status sets (spec.md A§4.3.7), referenced by id so a board
 * using one picks up fixes in new releases. Their rules read the conformed
 * keys of the built-in source rules: GitHub items' `name` and `state`, an
 * Amplify record's `state`. Job names (*deploy*, *test*) live only here,
 * as data. *GitHub deploy and test*: a failed, cancelled or running counted
 * job decides first; then success in the final phase (test if there are
 * test jobs); then partial success; then queued.
 *
 * @module
 */
import type { z } from 'zod';

import { STATUS_COLORS } from '@/domain/config/colors';
import {
  PRESET_IDS,
  type StatusSet,
  StatusSetSchema,
} from '@/domain/config/statusSets';
import {
  BUILTIN_KEYS,
  itemKeyPath,
  ITEMS_PATH,
  itemsFilterPath,
  keyPath,
  STATES,
} from '@/domain/model/keys';
import { all, check, exists, is, not } from '@/domain/model/ruleBuilders';
import { always } from '@/domain/rules/always';

import {
  DEPLOY,
  JOB_WORDS,
  PRESET_SUMMARY,
  PRESET_SUMMARY_IDS as S,
  QUEUED_LOOK,
  recordState,
  some,
  state,
  status,
  TEST,
} from './presetRules';

const C = STATUS_COLORS;

const notSkipped = not(is(keyPath(BUILTIN_KEYS.state), STATES.skipped));

const deployTest: z.input<typeof StatusSetSchema> = {
  id: PRESET_IDS.githubDeployTest,
  name: 'GitHub deploy and test',
  provider: 'github',
  items: all(
    check({
      path: keyPath(BUILTIN_KEYS.name),
      operator: 'regex',
      value: `${JOB_WORDS.deploy}|${JOB_WORDS.test}`,
    }),
    notSkipped,
  ),
  summary: PRESET_SUMMARY,
  cell: [
    status(
      'testFailed',
      'Tests failed',
      C.testFailure,
      S.failing,
      some(`${TEST} && ${state(STATES.failed)}`),
    ),
    status(
      'deployFailed',
      'Deploy failed',
      C.failure,
      S.failing,
      some(`${DEPLOY} && ${state(STATES.failed)}`),
    ),
    status(
      'cancelled',
      'Cancelled',
      C.cancelled,
      S.cancelled,
      some(state(STATES.cancelled)),
    ),
    status(
      'testing',
      'Testing',
      C.testing,
      S.running,
      some(`${TEST} && ${state(STATES.running)}`),
    ),
    status(
      'deploying',
      'Deploying',
      C.started,
      S.running,
      some(`${DEPLOY} && ${state(STATES.running)}`),
    ),
    status(
      'passed',
      'Passed',
      C.success,
      S.ok,
      some(`${TEST} && ${state(STATES.succeeded)}`),
    ),
    status(
      'deployed',
      'Deployed',
      C.deployed,
      S.ok,
      all(
        not(exists(itemsFilterPath(TEST))),
        exists(itemsFilterPath(`${DEPLOY} && ${state(STATES.succeeded)}`)),
      ),
    ),
    status(
      'partial',
      'Partial',
      C.partial,
      S.running,
      some(state(STATES.succeeded)),
      { icon: 'partial' },
    ),
    status(
      'queued',
      'Queued',
      C.queued,
      S.running,
      all(exists(ITEMS_PATH)),
      QUEUED_LOOK,
    ),
  ],
};

const singleJob: z.input<typeof StatusSetSchema> = {
  id: PRESET_IDS.githubSingleJob,
  name: 'GitHub single job',
  provider: 'github',
  items: all(notSkipped),
  summary: PRESET_SUMMARY,
  cell: [
    status(
      'failed',
      'Failed',
      C.failure,
      S.failing,
      some(state(STATES.failed)),
    ),
    status(
      'cancelled',
      'Cancelled',
      C.cancelled,
      S.cancelled,
      some(state(STATES.cancelled)),
    ),
    status(
      'running',
      'Running',
      C.started,
      S.running,
      some(state(STATES.running)),
    ),
    status(
      'queued',
      'Queued',
      C.queued,
      S.running,
      some(state(STATES.queued)),
      QUEUED_LOOK,
    ),
    status(
      'succeeded',
      'Succeeded',
      C.success,
      S.ok,
      all(
        check({
          path: itemKeyPath(BUILTIN_KEYS.state),
          value: STATES.succeeded,
          quantifier: 'every',
        }),
      ),
    ),
  ],
};

const amplify: z.input<typeof StatusSetSchema> = {
  id: PRESET_IDS.amplify,
  name: 'Amplify',
  provider: 'amplify',
  items: always,
  summary: PRESET_SUMMARY,
  cell: [
    status(
      'failed',
      'Failed',
      C.failure,
      S.failing,
      recordState(STATES.failed),
    ),
    status(
      'cancelled',
      'Cancelled',
      C.cancelled,
      S.cancelled,
      recordState(STATES.cancelled),
    ),
    status(
      'running',
      'Running',
      C.started,
      S.running,
      recordState(STATES.running),
    ),
    status(
      'queued',
      'Queued',
      C.queued,
      S.running,
      recordState(STATES.queued),
      QUEUED_LOOK,
    ),
    status(
      'deployed',
      'Deployed',
      C.success,
      S.ok,
      recordState(STATES.succeeded),
    ),
  ],
};

/** The built-in status sets. */
export const PRESETS: readonly StatusSet[] = [
  deployTest,
  singleJob,
  amplify,
].map((p) => StatusSetSchema.parse(p));

/** The bundled preset `id`; a missing one is a bug. */
export function presetById(id: string): StatusSet {
  const preset = PRESETS.find((p) => p.id === id);
  if (!preset) throw new Error(`no preset ${id}`);
  return preset;
}
