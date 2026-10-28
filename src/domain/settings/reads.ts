/**
 * Which fields a place can set, and whether anything under it reads them
 * (spec.md §3.11 *The settings editor*, Decision 53). At a row or a cell
 * only what can apply to the row is settable: its own source, no AWS key
 * on a GitHub row, no GitHub token on an Amplify row without a repo, and
 * an item rule only where the source rule reads items. Elsewhere every
 * field is settable, and one no row under the place reads is marked
 * *nothing here reads it yet*, its control still usable. Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import { type Provider, PROVIDERS } from '@/domain/config/providers';
import type { Row } from '@/domain/config/row';

import type { SettingsPlace } from './places';

/** One entry of the settings editor: a field, and its source when the
 * field is per source. */
export type SettingEntry =
  | { field: 'githubToken' | 'awsKey' }
  | { field: 'statusSets' | 'itemRules'; source: Provider };

/** Does `row` read `entry`? */
export function rowReads(
  row: Pick<Row, 'type' | 'repo'>,
  entry: SettingEntry,
): boolean {
  switch (entry.field) {
    case 'githubToken':
      return row.type === 'github' || row.repo !== undefined;
    case 'awsKey':
      return row.type === 'amplify';
    default:
      return row.type === entry.source;
  }
}

/** The row a row or cell place is on. */
const rowAt = (d: Dashboard, place: SettingsPlace): Row | undefined =>
  place.level === 'row' || place.level === 'cell'
    ? d.rows.find((r) => r.id === place.rowId)
    : undefined;

/** Every entry, in the editor's fixed order; item rules only for the
 * sources in `withItems`. */
const allEntries = (withItems: readonly Provider[]): SettingEntry[] => [
  { field: 'githubToken' },
  { field: 'awsKey' },
  ...PROVIDERS.flatMap((source): SettingEntry[] => [
    { field: 'statusSets', source },
    ...(withItems.includes(source)
      ? [{ field: 'itemRules', source } as const]
      : []),
  ]),
];

/** The entries settable at `place`, in order; `withItems` are the
 * sources whose source rule reads items. */
export function settableEntries(
  d: Dashboard,
  place: SettingsPlace,
  withItems: readonly Provider[],
): SettingEntry[] {
  const entries = allEntries(withItems);
  const row = rowAt(d, place);
  if (place.level === 'row' || place.level === 'cell')
    return row ? entries.filter((e) => rowReads(row, e)) : [];
  return entries;
}

/** The rows under `place`: a row group's members, a row or cell's row,
 * else every row. */
export function rowsUnder(d: Dashboard, place: SettingsPlace): readonly Row[] {
  switch (place.level) {
    case 'rowGroup': {
      const ids =
        d.rowGroups.find((g) => g.id === place.groupId)?.memberIds ?? [];
      return d.rows.filter((r) => ids.includes(r.id));
    }
    case 'row':
    case 'cell':
      return d.rows.filter((r) => r.id === place.rowId);
    default:
      return d.rows;
  }
}

/** Does any row under `place` read `entry`? `false` is shown as
 * *nothing here reads it yet*. */
export const readsAt = (
  d: Dashboard,
  place: SettingsPlace,
  entry: SettingEntry,
): boolean => rowsUnder(d, place).some((row) => rowReads(row, entry));

/** The source an entry's value is read for: its own, or for an unkeyed
 * field any (credential fields hold the same id for every source). */
export const entrySource = (entry: SettingEntry): Provider =>
  'source' in entry ? entry.source : 'github';
