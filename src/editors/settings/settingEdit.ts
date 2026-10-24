/**
 * Reading and changing one entry of the settings editor (spec.md §3.11):
 * the value set at a place, what the place inherits, the more specific
 * places that win over it, and the dashboard with the entry set or reset.
 * Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import {
  setSettings,
  settingsAt,
  type SettingsPlace,
} from '@/domain/settings/places';
import { entrySource, type SettingEntry } from '@/domain/settings/reads';
import {
  inheritedAt,
  type Resolved,
  shadowsAt,
} from '@/domain/settings/resolve';
import {
  readSetting,
  type SettingValues,
  writeSetting,
} from '@/domain/settings/schema';

/** What an entry holds. */
export type EntryValue = SettingValues[SettingEntry['field']];

/** The value set for `entry` at `place`, if any. */
export const ownValue = (
  d: Dashboard,
  place: SettingsPlace,
  entry: SettingEntry,
): EntryValue | undefined =>
  readSetting(settingsAt(d, place), entry.field, entrySource(entry));

/** What `place` inherits for `entry`, and where from. */
export const inheritedValue = (
  d: Dashboard,
  place: SettingsPlace,
  entry: SettingEntry,
): Resolved<EntryValue | undefined> =>
  inheritedAt(d, place, entry.field, entrySource(entry));

/** The more specific places that set `entry` and win where they meet
 * `place`. */
export const shadowsOf = (
  d: Dashboard,
  place: SettingsPlace,
  entry: SettingEntry,
): SettingsPlace[] => shadowsAt(d, place, entry.field, entrySource(entry));

/** `d` with `entry` at `place` set to `value`, or reset (removed) by
 * `undefined`. */
export function setEntry(
  d: Dashboard,
  place: SettingsPlace,
  entry: SettingEntry,
  value: EntryValue | undefined,
): Dashboard {
  const own = settingsAt(d, place) ?? {};
  return setSettings(
    d,
    place,
    writeSetting(own, entry.field, entrySource(entry), value),
  );
}
