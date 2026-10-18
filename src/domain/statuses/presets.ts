/**
 * The bundled status sets (spec.md A§4.3.6), referenced by id so a board
 * using one picks up fixes in new releases, and the built-in Unknown
 * status. *GitHub deploy and test* reproduces today's rules (A§4.3.3) over
 * jobs named *deploy* and *test*: a failed, cancelled or running relevant
 * job decides first; then success in the final phase (test if there are
 * test jobs); then partial success; then queued.
 *
 * @module
 */
import type { MatchTest } from '@/domain/config/matchTest';
import {
  type CellStatus,
  type StatusSet,
  StatusSetSchema,
  type SummaryStatus,
} from '@/domain/config/statusSets';

import {
  all,
  anyJob,
  everyJob,
  FAILED,
  type JsonSchema,
  nameMatches,
  not,
  oneOf,
  running,
  waiting,
} from './schemaBuilders';

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
  test: JsonSchema,
  extra: Partial<CellStatus> = {},
): CellStatus => ({
  id,
  name,
  color,
  summary,
  test,
  outlined: false,
  ...extra,
});

/** Cell statuses for jobs whose names pass the deploy and test phase tests
 * (a job passing both is a test job, as today). */
function deployTestStatuses(
  deployTests: readonly MatchTest[],
  testTests: readonly MatchTest[],
): CellStatus[] {
  const isTest = nameMatches(testTests);
  const isDeploy = all(nameMatches(deployTests), not(isTest));
  const relevant = { anyOf: [isDeploy, isTest] };
  const failed = oneOf('conclusion', FAILED);
  const succeeded = oneOf('conclusion', ['success']);
  return [
    status(
      'testFailed',
      'Tests failed',
      '#b91c1c',
      'failing',
      anyJob(all(isTest, failed)),
    ),
    status(
      'deployFailed',
      'Deploy failed',
      '#dc2626',
      'failing',
      anyJob(all(isDeploy, failed)),
    ),
    status(
      'cancelled',
      'Cancelled',
      '#475569',
      'cancelled',
      anyJob(all(relevant, oneOf('conclusion', ['cancelled']))),
    ),
    status(
      'testing',
      'Testing',
      '#4f46e5',
      'running',
      anyJob(all(isTest, running)),
    ),
    status(
      'deploying',
      'Deploying',
      '#2563eb',
      'running',
      anyJob(all(isDeploy, running)),
    ),
    status('passed', 'Passed', '#15803d', 'ok', anyJob(all(isTest, succeeded))),
    status(
      'deployed',
      'Deployed',
      '#0f766e',
      'ok',
      all(not(anyJob(isTest)), anyJob(all(isDeploy, succeeded))),
    ),
    status(
      'partial',
      'Partial',
      '#0e7490',
      'ok',
      anyJob(all(relevant, succeeded)),
      { icon: 'partial' },
    ),
    status('queued', 'Queued', '#e2e8f0', 'running', anyJob(relevant), {
      icon: 'queued',
      outlined: true,
    }),
  ];
}

const contains = (value: string): MatchTest => ({
  field: 'jobName',
  operator: 'contains',
  value,
});

const amplify = (statuses: readonly string[]): JsonSchema =>
  oneOf('status', statuses);

export const PRESETS: readonly StatusSet[] = [
  {
    id: 'github-deploy-test',
    name: 'GitHub deploy and test',
    provider: 'github',
    summary: PRESET_SUMMARY,
    cell: deployTestStatuses([contains('deploy')], [contains('test')]),
  },
  {
    id: 'github-single-job',
    name: 'GitHub single job',
    provider: 'github',
    summary: PRESET_SUMMARY,
    cell: [
      status(
        'failed',
        'Failed',
        '#dc2626',
        'failing',
        anyJob(oneOf('conclusion', FAILED)),
      ),
      status(
        'cancelled',
        'Cancelled',
        '#475569',
        'cancelled',
        anyJob(oneOf('conclusion', ['cancelled'])),
      ),
      status('running', 'Running', '#2563eb', 'running', anyJob(running)),
      status('queued', 'Queued', '#e2e8f0', 'running', anyJob(waiting), {
        icon: 'queued',
        outlined: true,
      }),
      status(
        'succeeded',
        'Succeeded',
        '#15803d',
        'ok',
        everyJob(oneOf('conclusion', ['success'])),
      ),
    ],
  },
  {
    id: 'amplify',
    name: 'Amplify',
    provider: 'amplify',
    summary: PRESET_SUMMARY,
    cell: [
      status('failed', 'Failed', '#dc2626', 'failing', amplify(['FAILED'])),
      status(
        'cancelled',
        'Cancelled',
        '#475569',
        'cancelled',
        amplify(['CANCELLED', 'CANCELLING']),
      ),
      status('running', 'Running', '#2563eb', 'running', amplify(['RUNNING'])),
      status(
        'queued',
        'Queued',
        '#e2e8f0',
        'running',
        amplify(['PENDING', 'PROVISIONING', 'CREATED']),
        { icon: 'queued', outlined: true },
      ),
      status('deployed', 'Deployed', '#15803d', 'ok', amplify(['SUCCEED'])),
    ],
  },
].map((p) => StatusSetSchema.parse(p));

/** The set with `id`: a bundled preset, or one of `custom`. */
export const findStatusSet = (
  id: string,
  custom: readonly StatusSet[] = [],
): StatusSet | undefined =>
  PRESETS.find((p) => p.id === id) ?? custom.find((s) => s.id === id);
