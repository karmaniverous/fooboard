/**
 * The names of the board's actions that the first run's note repeats
 * (spec 0.2.0 §3.A): each icon button is named, and tooltipped, by the
 * title of what it opens, with its count.
 *
 * @module
 */

/** The Unmapped runs panel's title. */
export const UNMAPPED_RUNS = 'Unmapped runs';

/** The Unmapped runs button's name: the panel's title, with how many
 * entries it shows. */
export const unmappedLabel = (count: number): string =>
  `${UNMAPPED_RUNS} (${String(count)})`;

/** The editor's title, and its button's name. */
export const EDIT_DASHBOARD = 'Edit dashboard';
