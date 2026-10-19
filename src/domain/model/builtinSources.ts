/**
 * The built-in source rules (spec.md A§4.3.7), referenced by id so a board
 * picks up fixes in new releases. GitHub: a record per workflow run (its
 * latest attempt's jobs as items); Amplify: a record per job. Both give
 * items (GitHub) or records (Amplify) a conformed `state`: failed,
 * cancelled, running, queued, succeeded or (GitHub) skipped.
 *
 * @module
 */
import { type Provider, PROVIDER_LABELS } from '@/domain/config/providers';

import { all, any, copy, exists, give, is, not } from './ruleBuilders';
import {
  isSourceRuleFor,
  type SourceRule,
  type SourceRuleOf,
  SourceRuleSchema,
} from './sourceRule';

/** The built-in source rule each source uses unless a dashboard chooses
 * another. */
export const DEFAULT_SOURCE_RULE_IDS = {
  github: 'github',
  amplify: 'amplify',
} as const satisfies Record<Provider, string>;

/** The key each built-in source rule orders records by. */
export const BUILTIN_ORDER_KEYS = {
  github: 'created',
  amplify: 'started',
} as const satisfies Record<Provider, string>;

const github = SourceRuleSchema.parse({
  id: DEFAULT_SOURCE_RULE_IDS.github,
  name: PROVIDER_LABELS.github,
  provider: 'github',
  keys: [
    { name: 'workflow', translations: [copy('$.run.workflowName')] },
    { name: 'event', translations: [copy('$.run.event')] },
    { name: 'branch', translations: [copy('$.run.headBranch'), give('')] },
    { name: 'commit', translations: [copy('$.run.headSha')] },
    {
      name: 'message',
      translations: [copy('$.run.headCommitMessage'), give('')],
    },
    { name: 'time', translations: [copy('$.run.createdAt')] },
    { name: 'link', translations: [copy('$.run.htmlUrl')] },
    {
      name: BUILTIN_ORDER_KEYS.github,
      translations: [copy('$.run.createdAt')],
    },
  ],
  items: {
    path: '$.jobs[*]',
    keys: [
      { name: 'name', translations: [copy('$.name')] },
      {
        name: 'state',
        translations: [
          give(
            'failed',
            all(is('$.conclusion', '{failure,timed_out,startup_failure}')),
          ),
          give('cancelled', all(is('$.conclusion', 'cancelled'))),
          give(
            'running',
            all(is('$.status', 'in_progress'), not(exists('$.conclusion'))),
          ),
          give(
            'queued',
            any(
              is('$.status', '{queued,waiting,pending,requested}'),
              is('$.conclusion', 'action_required'),
            ),
          ),
          give('succeeded', all(is('$.conclusion', 'success'))),
          give('skipped', all(is('$.conclusion', '{skipped,neutral,stale}'))),
          give(''),
        ],
      },
      {
        name: 'time',
        translations: [copy('$.completedAt'), copy('$.startedAt'), give('')],
      },
      { name: 'link', translations: [copy('$.htmlUrl')] },
    ],
  },
  order: BUILTIN_ORDER_KEYS.github,
});

const amplify = SourceRuleSchema.parse({
  id: DEFAULT_SOURCE_RULE_IDS.amplify,
  name: PROVIDER_LABELS.amplify,
  provider: 'amplify',
  keys: [
    { name: 'branch', translations: [copy('$.branch')] },
    { name: 'commit', translations: [copy('$.job.commitId'), give('')] },
    { name: 'message', translations: [copy('$.job.commitMessage'), give('')] },
    {
      name: 'time',
      translations: [copy('$.job.endTime'), copy('$.job.startTime'), give('')],
    },
    { name: 'link', translations: [copy('$.consoleUrl')] },
    {
      name: BUILTIN_ORDER_KEYS.amplify,
      translations: [copy('$.job.startTime')],
    },
    {
      name: 'state',
      translations: [
        give('failed', all(is('$.job.status', 'FAILED'))),
        give('cancelled', all(is('$.job.status', '{CANCELLED,CANCELLING}'))),
        give('running', all(is('$.job.status', 'RUNNING'))),
        give(
          'queued',
          all(is('$.job.status', '{PENDING,PROVISIONING,CREATED}')),
        ),
        give('succeeded', all(is('$.job.status', 'SUCCEED'))),
      ],
    },
  ],
  order: BUILTIN_ORDER_KEYS.amplify,
});

/** The built-in source rules. */
export const BUILTIN_SOURCES: readonly SourceRule[] = [github, amplify];

/** The built-in source rule for `provider`. */
export function builtinSourceFor<P extends Provider>(
  provider: P,
): SourceRuleOf<P> {
  const rule = BUILTIN_SOURCES.find((s) => isSourceRuleFor(s, provider));
  if (!isSourceRuleFor(rule, provider))
    throw new Error(`no built-in source rule for ${provider}`);
  return rule;
}
