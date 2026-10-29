/**
 * The names of the board's actions (spec 0.2.0 §3.A): each icon button is
 * named, and tooltipped, by the title of what it opens, with its count
 * where there is one. One place, so the buttons, their panels and the
 * first run's note that names them can't drift apart.
 *
 * @module
 */

/** The legend's name: its button's, its tooltip's and its popover's. */
export const LEGEND = 'Legend';

/** The Unmapped runs panel's title. */
export const UNMAPPED_RUNS = 'Unmapped runs';

/** The Unmapped runs button's name: the panel's title, with how many
 * entries it shows. */
export const unmappedLabel = (count: number): string =>
  `${UNMAPPED_RUNS} (${String(count)})`;

/** The editor's title, and its button's name. */
export const EDIT_DASHBOARD = 'Edit dashboard';

/** The Credentials panel's title, and its button's name once the
 * dashboard has a credential. */
export const CREDENTIALS = 'Credentials';

/** The Credentials button's name while the dashboard has none. */
export const ADD_A_CREDENTIAL = 'Add a credential';
