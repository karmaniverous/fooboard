/**
 * The parts the bundled status sets are built from (spec.md A§4.3.3): the
 * summary statuses every preset shares, a cell status with its defaults,
 * and the filters over the built-in source rules' conformed keys (a job's
 * `name` and `state`, an Amplify record's `state`). Pure.
 *
 * @module
 */
import { STATUS_COLORS } from '@/domain/config/colors';
import type { CellStatus, SummaryStatus } from '@/domain/config/statusSets';
import {
  BUILTIN_KEYS,
  itemsFilterPath,
  keyPath,
  relativeKeyPath,
} from '@/domain/model/keys';
import { all, exists, is } from '@/domain/model/ruleBuilders';
import { caseless, quoted } from '@/domain/rules/path';
import type { Rule } from '@/domain/rules/schema';

/** The ids of the summary statuses every preset uses. */
export const PRESET_SUMMARY_IDS = {
  failing: 'failing',
  running: 'running',
  cancelled: 'cancelled',
  ok: 'ok',
} as const;

/** The words that make a GitHub job a test or a deploy job. */
export const JOB_WORDS = { test: 'test', deploy: 'deploy' } as const;

const S = PRESET_SUMMARY_IDS;
const C = STATUS_COLORS;

/** The summary statuses every preset uses. */
export const PRESET_SUMMARY: SummaryStatus[] = [
  {
    id: S.failing,
    name: 'Failing',
    color: C.failure,
    icon: 'failure',
    inProgress: false,
  },
  {
    id: S.running,
    name: 'Running',
    color: C.started,
    icon: 'running',
    inProgress: true,
  },
  {
    id: S.cancelled,
    name: 'Cancelled',
    color: C.cancelled,
    icon: 'cancelled',
    inProgress: false,
  },
  {
    id: S.ok,
    name: 'OK',
    color: C.success,
    icon: 'success',
    inProgress: false,
  },
];

/** A cell status, not outlined unless `extra` says so. */
export const status = (
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

/** How a queued status looks: its icon, outlined. */
export const QUEUED_LOOK = { icon: 'queued', outlined: true } as const;

const jobName = relativeKeyPath(BUILTIN_KEYS.name);
/** A filter: the item's name contains `word`, ignoring case. */
const named = (word: string) => `search(${jobName}, ${quoted(caseless(word))})`;

/** Filters: a test job, and a deploy job (any job that isn't a test). */
export const TEST = named(JOB_WORDS.test);
export const DEPLOY = `${named(JOB_WORDS.deploy)} && !${TEST}`;

/** Some item where `filter` holds. */
export const some = (filter: string): Rule =>
  all(exists(itemsFilterPath(filter)));

/** A filter: the item's state is `s`. */
export const state = (s: string): string =>
  `${relativeKeyPath(BUILTIN_KEYS.state)} == ${quoted(s)}`;

/** A rule: the record's own state is `s` (Amplify). */
export const recordState = (s: string): Rule =>
  all(is(keyPath(BUILTIN_KEYS.state), s));
