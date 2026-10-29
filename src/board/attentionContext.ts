/**
 * How the board hears the user's interest in its rows (spec 0.2.0 §3.H
 * *Plumbing*): `BoardScreen` provides `attend`, which boosts the polling of
 * the rows a target covers (a row, or every row of a row group) through
 * the live board model; `CellGearLayer` (clicks, keys and dwells, through
 * `useAttentionEvents`) and `SettingsPopupProvider` (settings opened) read
 * it without props through the grid. Rendered outside a board (component
 * tests), the default does nothing.
 *
 * @module
 */
import { createContext, use } from 'react';

import type { Dashboard } from '@/domain/config/dashboard';
import type { BoostKind } from '@/query/intervals';

import type { BoardPlace } from './settingsGearWords';

/** What the user showed interest in: a row, or a row group's rows. */
export type AttentionTarget =
  { level: 'row'; rowId: string } | { level: 'rowGroup'; groupId: string };

/** Boost the rows `target` covers, for a `kind` of interest. */
export type Attend = (target: AttentionTarget, kind: BoostKind) => void;

export const AttentionContext = createContext<Attend>(() => undefined);

/** The board's `attend`, or one that does nothing outside a board. */
export const useAttend = (): Attend => use(AttentionContext);

/** The rows `target` covers on `dashboard`: the row, or the group's
 * members. */
export function attendedRows(
  dashboard: Dashboard,
  target: AttentionTarget,
): string[] {
  if (target.level === 'row') return [target.rowId];
  return (
    dashboard.rowGroups.find((g) => g.id === target.groupId)?.memberIds ?? []
  );
}

/** What opening the settings of `place` shows interest in: a cell's or a
 * row's row, a row group's rows; columns and column groups boost nothing
 * (a column spans every row, Decision 85). */
export function placeTarget(place: BoardPlace): AttentionTarget | undefined {
  switch (place.level) {
    case 'cell':
    case 'row':
      return { level: 'row', rowId: place.rowId };
    case 'rowGroup':
      return { level: 'rowGroup', groupId: place.groupId };
    case 'column':
    case 'columnGroup':
      return undefined;
  }
}
