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
import {
  type CellStatus,
  type StatusSet,
  StatusSetSchema,
  type SummaryStatus,
} from '@/domain/config/statusSets';
import { all, check, exists, is, not } from '@/domain/model/ruleBuilders';
import { always } from '@/domain/rules/always';
import type { Rule } from '@/domain/rules/schema';

/** The summary statuses every preset uses. */
const PRESET_SUMMARY: SummaryStatus[] = [
  {
    id: 'failing',
    name: 'Failing',
    color: '#dc2626',
    icon: 'failure',
    inProgress: false,
  },
  {
    id: 'running',
    name: 'Running',
    color: '#2563eb',
    icon: 'running',
    inProgress: true,
  },
  {
    id: 'cancelled',
    name: 'Cancelled',
    color: '#475569',
    icon: 'cancelled',
    inProgress: false,
  },
  {
    id: 'ok',
    name: 'OK',
    color: '#15803d',
    icon: 'success',
    inProgress: false,
  },
];

const status = (
  id: string,
  name: string,
  color: string,
  summary: string,
  rule: Rule,
  extra: Partial<CellStatus> = {},
): CellStatus => ({
  id,
  name,
  color,
  summary,
  rule,
  outlined: false,
  ...extra,
});

/** Case-insensitive `search()` source for `word` (RFC 9535 is
 * case-sensitive, so each letter becomes a class). */
const caseless = (word: string): string =>
  word.replace(/[a-z]/gi, (c) => `[${c.toUpperCase()}${c.toLowerCase()}]`);

const TEST = `search(@.name, '${caseless('test')}')`;
const DEPLOY = `search(@.name, '${caseless('deploy')}') && !${TEST}`;
/** Some item where `filter` holds. */
const some = (filter: string) => all(exists(`$.items[?${filter}]`));
const state = (s: string) => `@.state == '${s}'`;

const notSkipped = not(is('$.state', 'skipped'));

const deployTest = {
  id: 'github-deploy-test',
  name: 'GitHub deploy and test',
  provider: 'github',
  items: all(
    check({ path: '$.name', operator: 'regex', value: 'deploy|test' }),
    notSkipped,
  ),
  summary: PRESET_SUMMARY,
  cell: [
    status(
      'testFailed',
      'Tests failed',
      '#b91c1c',
      'failing',
      some(`${TEST} && ${state('failed')}`),
    ),
    status(
      'deployFailed',
      'Deploy failed',
      '#dc2626',
      'failing',
      some(`${DEPLOY} && ${state('failed')}`),
    ),
    status(
      'cancelled',
      'Cancelled',
      '#475569',
      'cancelled',
      some(state('cancelled')),
    ),
    status(
      'testing',
      'Testing',
      '#4f46e5',
      'running',
      some(`${TEST} && ${state('running')}`),
    ),
    status(
      'deploying',
      'Deploying',
      '#2563eb',
      'running',
      some(`${DEPLOY} && ${state('running')}`),
    ),
    status(
      'passed',
      'Passed',
      '#15803d',
      'ok',
      some(`${TEST} && ${state('succeeded')}`),
    ),
    status(
      'deployed',
      'Deployed',
      '#0f766e',
      'ok',
      all(
        not(exists(`$.items[?${TEST}]`)),
        exists(`$.items[?${DEPLOY} && ${state('succeeded')}]`),
      ),
    ),
    status(
      'partial',
      'Partial',
      '#0e7490',
      'running',
      some(state('succeeded')),
      { icon: 'partial' },
    ),
    status(
      'queued',
      'Queued',
      '#e2e8f0',
      'running',
      all(exists('$.items[*]')),
      {
        icon: 'queued',
        outlined: true,
      },
    ),
  ],
};

const singleJob = {
  id: 'github-single-job',
  name: 'GitHub single job',
  provider: 'github',
  items: all(notSkipped),
  summary: PRESET_SUMMARY,
  cell: [
    status('failed', 'Failed', '#dc2626', 'failing', some(state('failed'))),
    status(
      'cancelled',
      'Cancelled',
      '#475569',
      'cancelled',
      some(state('cancelled')),
    ),
    status('running', 'Running', '#2563eb', 'running', some(state('running'))),
    status('queued', 'Queued', '#e2e8f0', 'running', some(state('queued')), {
      icon: 'queued',
      outlined: true,
    }),
    status(
      'succeeded',
      'Succeeded',
      '#15803d',
      'ok',
      all(
        check({
          path: '$.items[*].state',
          value: 'succeeded',
          quantifier: 'every',
        }),
      ),
    ),
  ],
};

const amplify = {
  id: 'amplify',
  name: 'Amplify',
  provider: 'amplify',
  items: always,
  summary: PRESET_SUMMARY,
  cell: [
    status(
      'failed',
      'Failed',
      '#dc2626',
      'failing',
      all(is('$.state', 'failed')),
    ),
    status(
      'cancelled',
      'Cancelled',
      '#475569',
      'cancelled',
      all(is('$.state', 'cancelled')),
    ),
    status(
      'running',
      'Running',
      '#2563eb',
      'running',
      all(is('$.state', 'running')),
    ),
    status(
      'queued',
      'Queued',
      '#e2e8f0',
      'running',
      all(is('$.state', 'queued')),
      {
        icon: 'queued',
        outlined: true,
      },
    ),
    status(
      'deployed',
      'Deployed',
      '#15803d',
      'ok',
      all(is('$.state', 'succeeded')),
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
