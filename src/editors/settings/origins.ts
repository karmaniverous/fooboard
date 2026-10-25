/**
 * Settings origins and values in words (spec.md §3.11 *Origins*), the
 * same in every editor and in the cell detail sheet: *Cell*, *Row*,
 * *Column*, *Row group*, *Column group*, *Dashboard*, *Built-in*, each
 * with the level's name where it has one (an unlabelled group by its
 * first member). An inherited choice reads "<Level> default (<value>)",
 * with "from <name>" beside it; nothing to inherit reads *None (no
 * default is set)* for a credential, *Built-in (<set>)* for a status set
 * and *Every item counts* for an item rule. Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import { PROVIDER_LABELS } from '@/domain/config/providers';
import type { Row } from '@/domain/config/row';
import { sourcesWithItems } from '@/domain/model/sources';
import { describeRule } from '@/domain/rules/describe';
import { credentialName } from '@/domain/settings/credentials';
import type { SettingsPlace } from '@/domain/settings/places';
import { settableEntries, type SettingEntry } from '@/domain/settings/reads';
import { type Origin, resolveSetting } from '@/domain/settings/resolve';
import type { SettingValues } from '@/domain/settings/schema';
import { findStatusSet } from '@/domain/statuses/resolve';

/** Each level's word. */
const LEVEL_WORD: Record<Origin['level'], string> = {
  cell: 'Cell',
  row: 'Row',
  column: 'Column',
  rowGroup: 'Row group',
  columnGroup: 'Column group',
  dashboard: 'Dashboard',
  builtIn: 'Built-in',
};

const rowName = (d: Dashboard, id: string) =>
  d.rows.find((r) => r.id === id)?.displayName ?? id;
const stageName = (d: Dashboard, id: string) =>
  d.stages.find((s) => s.id === id)?.name ?? id;

/** A group's name: its label, else its first member's name. */
function groupName(d: Dashboard, place: SettingsPlace & { groupId: string }) {
  const groups = place.level === 'rowGroup' ? d.rowGroups : d.columnGroups;
  const group = groups.find((g) => g.id === place.groupId);
  if (!group) return place.groupId;
  if (group.label) return group.label;
  const first = group.memberIds[0] ?? '';
  return place.level === 'rowGroup' ? rowName(d, first) : stageName(d, first);
}

/** The name of the item at `origin`, if it has one. */
function originName(d: Dashboard, origin: Origin): string | undefined {
  switch (origin.level) {
    case 'dashboard':
      return d.name;
    case 'builtIn':
      return undefined;
    case 'rowGroup':
    case 'columnGroup':
      return groupName(d, origin);
    case 'row':
      return rowName(d, origin.rowId);
    case 'column':
      return stageName(d, origin.stageId);
    case 'cell':
      return `${rowName(d, origin.rowId)} × ${stageName(d, origin.stageId)}`;
  }
}

/** A place's level and name, e.g. "Row group Backend"; *Built-in*. */
export const placeLabel = (d: Dashboard, place: Origin): string =>
  [LEVEL_WORD[place.level], originName(d, place)]
    .filter((s) => s !== undefined)
    .join(' ');

/** The entry's name. */
export function entryName(entry: SettingEntry): string {
  switch (entry.field) {
    case 'githubToken':
      return 'GitHub token';
    case 'awsKey':
      return 'AWS key';
    case 'statusSets':
      return `${PROVIDER_LABELS[entry.source]} status set`;
    case 'itemRules':
      return `${PROVIDER_LABELS[entry.source]} item rule`;
  }
}

/** The entry's one-line description. */
export function entryDescription(entry: SettingEntry): string {
  switch (entry.field) {
    case 'githubToken':
      return "Reads a GitHub row's repo, and an Amplify row's repo for its badges.";
    case 'awsKey':
      return 'The AWS account an Amplify cell reads its apps in.';
    case 'statusSets':
      return `The statuses ${PROVIDER_LABELS[entry.source]} cells show.`;
    case 'itemRules':
      return `Which of a record's items count, for ${PROVIDER_LABELS[entry.source]} rows.`;
  }
}

/** What an entry holds. */
type Value = SettingValues[SettingEntry['field']];

/** A value in words: a credential's or set's name (its id if it names
 * none), or a rule's checks. */
function valueWords(d: Dashboard, entry: SettingEntry, value: Value): string {
  if (typeof value !== 'string') return describeRule(value, 'every item');
  if (entry.field === 'statusSets')
    return findStatusSet(value, d.customStatusSets)?.name ?? value;
  return credentialName(d, value);
}

/** What an inherited value reads as: "<Level> default (<value>)", or the
 * wording for nothing to inherit (only a credential has no built-in). */
export function inheritedWords(
  d: Dashboard,
  entry: SettingEntry,
  origin: Origin,
  value: Value | undefined,
): string {
  if (value === undefined) return 'None (no default is set)';
  if (origin.level !== 'builtIn')
    return `${LEVEL_WORD[origin.level]} default (${valueWords(d, entry, value)})`;
  return entry.field === 'itemRules'
    ? 'Every item counts'
    : `Built-in (${valueWords(d, entry, value)})`;
}

/** "from <name>", for an origin that has a name. */
export const fromWords = (d: Dashboard, origin: Origin): string | undefined => {
  const name = originName(d, origin);
  return name === undefined ? undefined : `from ${name}`;
};

/** "*a* and *b* set their own <field>, which wins there". */
export function shadowWords(
  d: Dashboard,
  entry: SettingEntry,
  shadows: readonly SettingsPlace[],
): string | undefined {
  if (shadows.length === 0) return undefined;
  const names = shadows.map((p) => originName(d, p) ?? LEVEL_WORD[p.level]);
  const list =
    names.length === 1
      ? names.join('')
      : `${names.slice(0, -1).join(', ')} and ${names.slice(-1).join('')}`;
  return `${list} ${names.length === 1 ? 'sets its' : 'set their'} own ${entryName(entry)}, which wins there`;
}

/** One resolved setting of a cell, in words. */
export interface CellSettingLine {
  name: string;
  value: string;
  origin: string;
}

/** What `row`'s cell in `stageId` reads for each field it can read, and
 * where each comes from (the cell detail sheet, spec.md §3.11). */
export function cellSettingLines(
  d: Dashboard,
  row: Row,
  stageId: string,
): CellSettingLine[] {
  const withItems = sourcesWithItems(d);
  const place: SettingsPlace = { level: 'cell', rowId: row.id, stageId };
  return settableEntries(d, place, withItems).map((entry) => {
    const { value, origin } = resolveSetting(d, row, stageId, entry.field);
    return {
      name: entryName(entry),
      value:
        value === undefined || origin.level === 'builtIn'
          ? inheritedWords(d, entry, origin, value)
          : valueWords(d, entry, value),
      origin: placeLabel(d, origin),
    };
  });
}
