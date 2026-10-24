/**
 * The settings object (spec.md §3.11, Decision 51): one optional object,
 * the same shape at six levels (dashboard, row group, column group, row,
 * column and cell), holding the values that may differ by row, by column
 * or by cell: the GitHub token, the AWS key, and a status set and an item
 * rule per source. Every field is optional; an unset field inherits.
 * Reading and writing one field is pure.
 *
 * @module
 */
import { shake } from 'radash';
import { z } from 'zod';

import type { Provider } from '@/domain/config/providers';
import { type Rule, RuleSchema } from '@/domain/rules/schema';

/** A credential id. */
const IdSchema = z.string().min(1);

/** The per-source fields keep their per-source keys at every level. */
const perSource = <T extends z.ZodType>(value: T) =>
  z.object({ github: value.optional(), amplify: value.optional() });

/** One level's settings. */
export const SettingsSchema = z.object({
  /** A GitHub credential id: reads a GitHub row's repo, or an Amplify
   * row's repo for its git link. */
  githubToken: IdSchema.optional(),
  /** An AWS credential id: the account an Amplify cell reads. */
  awsKey: IdSchema.optional(),
  /** A status-set id per source. */
  statusSets: perSource(z.string().min(1)).optional(),
  /** A row-axis item rule per source: which of a record's items count. */
  itemRules: perSource(RuleSchema).optional(),
});
export type Settings = z.infer<typeof SettingsSchema>;

/** The fields, in the order the settings editor lists them. */
export type SettingField =
  'githubToken' | 'awsKey' | 'statusSets' | 'itemRules';

/** What each field holds once read for one source. */
export interface SettingValues {
  githubToken: string;
  awsKey: string;
  statusSets: string;
  itemRules: Rule;
}

/** The axis that wins a tie at one tier (Decision 51): the column for
 * the AWS key (an account follows the build environment), the row for
 * the rest (the repo's workflows decide them). */
export const HOME: Record<SettingField, 'row' | 'column'> = {
  githubToken: 'row',
  awsKey: 'column',
  statusSets: 'row',
  itemRules: 'row',
};

type Readers = {
  [F in SettingField]: (
    s: Settings,
    source: Provider,
  ) => SettingValues[F] | undefined;
};

const READ: Readers = {
  githubToken: (s) => s.githubToken,
  awsKey: (s) => s.awsKey,
  statusSets: (s, source) => s.statusSets?.[source],
  itemRules: (s, source) => s.itemRules?.[source],
};

/** What one level's object gives for `field` (for `source`'s rows). */
export const readSetting = <F extends SettingField>(
  settings: Settings | undefined,
  field: F,
  source: Provider,
): SettingValues[F] | undefined =>
  settings === undefined ? undefined : READ[field](settings, source);

/** `group` with `source` set to `value`, or removed by `undefined`; an
 * emptied group is dropped. */
function withSource<T>(
  group: Partial<Record<Provider, T>> | undefined,
  source: Provider,
  value: T | undefined,
): Partial<Record<Provider, T>> | undefined {
  const next = shake({ ...group, [source]: value });
  return Object.keys(next).length > 0 ? next : undefined;
}

type Writers = {
  [F in SettingField]: (
    s: Settings,
    source: Provider,
    value: SettingValues[F] | undefined,
  ) => Settings;
};

const WRITE: Writers = {
  githubToken: (s, _source, value) => ({ ...s, githubToken: value }),
  awsKey: (s, _source, value) => ({ ...s, awsKey: value }),
  statusSets: (s, source, value) => ({
    ...s,
    statusSets: withSource(s.statusSets, source, value),
  }),
  itemRules: (s, source, value) => ({
    ...s,
    itemRules: withSource(s.itemRules, source, value),
  }),
};

/** `settings` with `field` (for `source`) set to `value`, or removed by
 * `undefined` (*Reset to inherited*). */
export const writeSetting = <F extends SettingField>(
  settings: Settings,
  field: F,
  source: Provider,
  value: SettingValues[F] | undefined,
): Settings => shake(WRITE[field](settings, source, value));

/** How many fields `settings` sets (each source of a per-source field
 * counting once): the count an enclosing disclosure shows. */
export const countSet = (settings: Settings | undefined): number =>
  settings === undefined
    ? 0
    : (settings.githubToken === undefined ? 0 : 1) +
      (settings.awsKey === undefined ? 0 : 1) +
      Object.keys(settings.statusSets ?? {}).length +
      Object.keys(settings.itemRules ?? {}).length;
