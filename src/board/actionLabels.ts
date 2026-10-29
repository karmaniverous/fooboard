/**
 * The names of the board's actions (spec 0.2.0 §3.A): each icon button is
 * named, and tooltipped, by the title of what it opens, with its count
 * where there is one. One place, so the buttons, their panels and the
 * first run's note that names them can't drift apart.
 *
 * @module
 */

/** A counted button's name: its panel's title, with how many entries it
 * shows. */
const counted = (title: string, count: number): string =>
  `${title} (${String(count)})`;

/** The legend's name: its button's, its tooltip's and its popover's. */
export const LEGEND = 'Legend';

/** The Unmapped runs panel's title. */
export const UNMAPPED_RUNS = 'Unmapped runs';

/** The Unmapped runs button's name. */
export const unmappedLabel = (count: number): string =>
  counted(UNMAPPED_RUNS, count);

/** The Problems panel's title, while it shows a problem (or nothing). */
export const PROBLEMS = 'Problems';

/** The Problems button's name, with how many problems it shows. */
export const problemsLabel = (count: number): string =>
  counted(PROBLEMS, count);

/** The same panel's title while it shows only notes. */
export const NOTES = 'Notes';

/** Its button's name then, with how many notes it shows. */
export const notesLabel = (count: number): string => counted(NOTES, count);

/** The editor's title, and its button's name. */
export const EDIT_DASHBOARD = 'Edit dashboard';

/** The Credentials panel's title, and its button's name once the
 * dashboard has a credential. */
export const CREDENTIALS = 'Credentials';

/** The Credentials button's name while the dashboard has none. */
export const ADD_A_CREDENTIAL = 'Add a credential';
