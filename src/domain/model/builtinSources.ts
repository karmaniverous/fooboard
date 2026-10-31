/**
 * The built-in source rules (spec.md A§4.3.7), referenced by id so a board
 * picks up fixes in new releases. GitHub: a record per workflow run (its
 * latest attempt's jobs as items); Amplify: a record per job. Both give
 * items (GitHub) or records (Amplify) a conformed `state`: failed,
 * cancelled, running, queued, succeeded or (GitHub) skipped.
 *
 * @module
 */
import { isEqual } from 'radash';
import type { z } from 'zod';

import { type Provider, PROVIDER_LABELS } from '@/domain/config/providers';

import { BUILTIN_KEYS, RESERVED_KEYS, STATES } from './keys';
import { all, any, copy, exists, give, is, not } from './ruleBuilders';
import {
  isSourceRuleFor,
  type KeyDef,
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

/** A built-in rule, its literals checked against the schema. */
const builtin = (rule: z.input<typeof SourceRuleSchema>): SourceRule =>
  SourceRuleSchema.parse(rule);

const github = builtin({
  id: DEFAULT_SOURCE_RULE_IDS.github,
  name: PROVIDER_LABELS.github,
  provider: 'github',
  keys: [
    { name: BUILTIN_KEYS.workflow, translations: [copy('$.run.workflowName')] },
    { name: BUILTIN_KEYS.event, translations: [copy('$.run.event')] },
    {
      name: RESERVED_KEYS.branch,
      translations: [copy('$.run.headBranch'), give('')],
    },
    { name: RESERVED_KEYS.commit, translations: [copy('$.run.headSha')] },
    {
      name: RESERVED_KEYS.message,
      translations: [copy('$.run.headCommitMessage'), give('')],
    },
    { name: RESERVED_KEYS.time, translations: [copy('$.run.createdAt')] },
    { name: RESERVED_KEYS.link, translations: [copy('$.run.htmlUrl')] },
    {
      name: BUILTIN_ORDER_KEYS.github,
      translations: [copy('$.run.createdAt')],
    },
  ],
  items: {
    path: '$.jobs[*]',
    keys: [
      { name: BUILTIN_KEYS.name, translations: [copy('$.name')] },
      {
        name: BUILTIN_KEYS.state,
        translations: [
          give(
            STATES.failed,
            all(is('$.conclusion', '{failure,timed_out,startup_failure}')),
          ),
          give(STATES.cancelled, all(is('$.conclusion', 'cancelled'))),
          give(
            STATES.running,
            all(is('$.status', 'in_progress'), not(exists('$.conclusion'))),
          ),
          give(
            STATES.queued,
            any(
              is('$.status', '{queued,waiting,pending,requested}'),
              is('$.conclusion', 'action_required'),
            ),
          ),
          give(STATES.succeeded, all(is('$.conclusion', 'success'))),
          give(
            STATES.skipped,
            all(is('$.conclusion', '{skipped,neutral,stale}')),
          ),
          give(''),
        ],
      },
      {
        name: RESERVED_KEYS.time,
        translations: [copy('$.completedAt'), copy('$.startedAt'), give('')],
      },
      { name: RESERVED_KEYS.link, translations: [copy('$.htmlUrl')] },
    ],
  },
  order: BUILTIN_ORDER_KEYS.github,
});

const amplify = builtin({
  id: DEFAULT_SOURCE_RULE_IDS.amplify,
  name: PROVIDER_LABELS.amplify,
  provider: 'amplify',
  keys: [
    { name: RESERVED_KEYS.branch, translations: [copy('$.branch')] },
    {
      name: RESERVED_KEYS.commit,
      translations: [copy('$.job.commitId'), give('')],
    },
    {
      name: RESERVED_KEYS.message,
      translations: [copy('$.job.commitMessage'), give('')],
    },
    {
      name: RESERVED_KEYS.time,
      translations: [copy('$.job.endTime'), copy('$.job.startTime'), give('')],
    },
    { name: RESERVED_KEYS.link, translations: [copy('$.consoleUrl')] },
    {
      name: BUILTIN_ORDER_KEYS.amplify,
      translations: [copy('$.job.startTime')],
    },
    {
      name: BUILTIN_KEYS.state,
      translations: [
        give(STATES.failed, all(is('$.job.status', 'FAILED'))),
        give(
          STATES.cancelled,
          all(is('$.job.status', '{CANCELLED,CANCELLING}')),
        ),
        give(STATES.running, all(is('$.job.status', 'RUNNING'))),
        give(
          STATES.queued,
          all(is('$.job.status', '{PENDING,PROVISIONING,CREATED}')),
        ),
        give(STATES.succeeded, all(is('$.job.status', 'SUCCEED'))),
      ],
    },
  ],
  order: BUILTIN_ORDER_KEYS.amplify,
});

/** The built-in source rules. */
export const BUILTIN_SOURCES: readonly SourceRule[] = [github, amplify];

/** Is `id` a built-in source rule's (a dashboard's own rules can't take
 * one)? */
export const isBuiltinSourceId = (id: string): boolean =>
  BUILTIN_SOURCES.some((s) => s.id === id);

/** The built-in source rule for `provider`. */
export function builtinSourceFor<P extends Provider>(
  provider: P,
): SourceRuleOf<P> {
  const rule = BUILTIN_SOURCES.find((s) => isSourceRuleFor(s, provider));
  if (!isSourceRuleFor(rule, provider))
    throw new Error(`no built-in source rule for ${provider}`);
  return rule;
}

/** The `branch` key of `rule`, if it has one. */
const branchKey = (rule: SourceRule): KeyDef | undefined =>
  rule.keys.find((key) => key.name === RESERVED_KEYS.branch);

/** Does `rule` give each record the branch its provider's built-in rule
 * gives (its `branch` key's translations and its `items` equal the
 * built-in's)? Then a record's branch is the branch name the provider
 * lists, whatever else a custom rule changes (spec 0.2.0 §3.B;
 * Decision 103). */
export function keepsBuiltinBranch(rule: SourceRule): boolean {
  const builtin = builtinSourceFor(rule.provider);
  return (
    isEqual(branchKey(rule)?.translations, branchKey(builtin)?.translations) &&
    isEqual(rule.items, builtin.items)
  );
}
