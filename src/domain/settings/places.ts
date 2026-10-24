/**
 * Where a settings object lives (spec.md §3.11): the six places, the
 * object at a place, the dashboard with a place's object replaced, and
 * every place of a dashboard that holds one. A cell's object lives on its
 * row (`rows[].cellSettings[stageId]`), beside the row's stage-rule
 * overrides, so removing a stage drops it and a row carries its cells.
 * Pure.
 *
 * @module
 */
import { omit } from 'radash';

import type { Dashboard } from '@/domain/config/dashboard';
import { ownOverride } from '@/domain/config/ownOverride';
import type { Row } from '@/domain/config/row';

import type { Settings } from './schema';

/** A place a settings object can be set. */
export type SettingsPlace =
  | { level: 'dashboard' }
  | { level: 'rowGroup'; groupId: string }
  | { level: 'columnGroup'; groupId: string }
  | { level: 'row'; rowId: string }
  | { level: 'column'; stageId: string }
  | { level: 'cell'; rowId: string; stageId: string };

/** The object at `place`, if the place exists and has one. */
export function settingsAt(
  d: Dashboard,
  place: SettingsPlace,
): Settings | undefined {
  switch (place.level) {
    case 'dashboard':
      return d.settings;
    case 'rowGroup':
      return d.rowGroups.find((g) => g.id === place.groupId)?.settings;
    case 'columnGroup':
      return d.columnGroups.find((g) => g.id === place.groupId)?.settings;
    case 'row':
      return d.rows.find((r) => r.id === place.rowId)?.settings;
    case 'column':
      return d.stages.find((s) => s.id === place.stageId)?.settings;
    case 'cell': {
      const row = d.rows.find((r) => r.id === place.rowId);
      return row ? ownOverride(row.cellSettings, place.stageId) : undefined;
    }
  }
}

/** `row` with its cell in `stageId` holding `settings` (an empty object
 * removes the cell's entry). */
const withCell = <R extends Row>(
  row: R,
  stageId: string,
  settings: Settings,
): R => ({
  ...row,
  cellSettings:
    Object.keys(settings).length > 0
      ? { ...row.cellSettings, [stageId]: settings }
      : omit(row.cellSettings, [stageId]),
});

/** `items` with the one whose id is `id` changed. */
const update = <T extends { id: string }>(
  items: readonly T[],
  id: string,
  change: (item: T) => T,
): T[] => items.map((item) => (item.id === id ? change(item) : item));

/** `d` with `place`'s object replaced by `settings` (pure; the caller
 * validates and saves). The dashboard keeps its requests in flight. */
export function setSettings(
  d: Dashboard,
  place: SettingsPlace,
  settings: Settings,
): Dashboard {
  switch (place.level) {
    case 'dashboard':
      return {
        ...d,
        settings: {
          ...settings,
          requestsInFlight: d.settings.requestsInFlight,
        },
      };
    case 'rowGroup':
      return {
        ...d,
        rowGroups: update(d.rowGroups, place.groupId, (g) => ({
          ...g,
          settings,
        })),
      };
    case 'columnGroup':
      return {
        ...d,
        columnGroups: update(d.columnGroups, place.groupId, (g) => ({
          ...g,
          settings,
        })),
      };
    case 'row':
      return {
        ...d,
        rows: update(d.rows, place.rowId, (r) => ({ ...r, settings })),
      };
    case 'column':
      return {
        ...d,
        stages: update(d.stages, place.stageId, (s) => ({ ...s, settings })),
      };
    case 'cell':
      return {
        ...d,
        rows: update(d.rows, place.rowId, (r) =>
          withCell(r, place.stageId, settings),
        ),
      };
  }
}

/** One place of a dashboard holding an object, with the schema path to
 * it (for integrity issues). */
export interface HeldSettings {
  place: SettingsPlace;
  settings: Settings;
  path: (string | number)[];
}

/** Every place of `d` that holds an object, in document order. */
export function heldSettings(
  d: Pick<
    Dashboard,
    'settings' | 'rowGroups' | 'columnGroups' | 'rows' | 'stages'
  >,
): HeldSettings[] {
  return [
    { place: { level: 'dashboard' }, settings: d.settings, path: ['settings'] },
    ...d.rowGroups.map((g, i): HeldSettings => ({
      place: { level: 'rowGroup', groupId: g.id },
      settings: g.settings,
      path: ['rowGroups', i, 'settings'],
    })),
    ...d.columnGroups.map((g, i): HeldSettings => ({
      place: { level: 'columnGroup', groupId: g.id },
      settings: g.settings,
      path: ['columnGroups', i, 'settings'],
    })),
    ...d.stages.map((s, i): HeldSettings => ({
      place: { level: 'column', stageId: s.id },
      settings: s.settings,
      path: ['stages', i, 'settings'],
    })),
    ...d.rows.flatMap((r, i): HeldSettings[] => [
      {
        place: { level: 'row', rowId: r.id },
        settings: r.settings,
        path: ['rows', i, 'settings'],
      },
      ...Object.entries(r.cellSettings).map(
        ([stageId, settings]): HeldSettings => ({
          place: { level: 'cell', rowId: r.id, stageId },
          settings,
          path: ['rows', i, 'cellSettings', stageId],
        }),
      ),
    ]),
  ];
}

/** `d` with every held object rewritten by `change` (credential re-iding,
 * swapping a status set). */
export const mapSettings = (
  d: Dashboard,
  change: (settings: Settings) => Settings,
): Dashboard =>
  heldSettings(d).reduce(
    (out, held) => setSettings(out, held.place, change(held.settings)),
    d,
  );
