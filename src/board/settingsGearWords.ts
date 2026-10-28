/**
 * The board's settings places in words (spec.md §3.11 *Settings on the
 * board*): each gear's accessible name ("Settings for row api-users",
 * "Settings for cell api-users, prod") and its popup's title ("Row
 * settings: api-users", "Cell settings: api-users × prod"). Items are
 * named as origins are (`placeName`). Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import type { SettingsPlace } from '@/domain/settings/places';
import { placeName } from '@/editors/settings/origins';

/** A place with a gear on the board: every level but the dashboard. */
export type BoardPlace = Exclude<SettingsPlace, { level: 'dashboard' }>;

/** Each level's word on the board (a column is a stage there). */
const WORD: Record<BoardPlace['level'], string> = {
  row: 'row',
  column: 'stage',
  rowGroup: 'row group',
  columnGroup: 'column group',
  cell: 'cell',
};

/** The gear's accessible name, e.g. "Settings for row api-users". */
export function gearLabel(d: Dashboard, place: BoardPlace): string {
  const name =
    place.level === 'cell'
      ? `${placeName(d, { level: 'row', rowId: place.rowId })}, ${placeName(d, {
          level: 'column',
          stageId: place.stageId,
        })}`
      : placeName(d, place);
  return `Settings for ${WORD[place.level]} ${name}`;
}

/** The popup's title, e.g. "Row settings: api-users". */
export function popupTitle(d: Dashboard, place: BoardPlace): string {
  const word = WORD[place.level];
  return `${word.charAt(0).toUpperCase()}${word.slice(1)} settings: ${placeName(d, place)}`;
}
