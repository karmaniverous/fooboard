/**
 * The words of dismissing unmapped runs (spec 0.2.0 §3.I): the panel's
 * heading and buttons, and the *Dismiss…* form's. Pure.
 *
 * @module
 */
import type { UnmappedRun } from '@/engine';

/** Opens an entry's form. */
export const DISMISS_OPEN = 'Dismiss…';
/** Saves the form's pattern. */
export const DISMISS = 'Dismiss';
export const CANCEL = 'Cancel';
/** Lists the dismissed entries (a toggle, this visit only). */
export const SHOW_DISMISSED = 'Show dismissed';
/** Removes the pattern hiding a dismissed entry. */
export const UNDO = 'Undo';
/** Why *Dismiss* is disabled while the pattern sets no field. */
export const NEED_A_FIELD = 'Set at least one field';
/** The preset choice's name, distinct from the *Dismiss* button's. */
export const PRESET_CHOICE = 'Which runs to dismiss';

const plural = (n: number, one: string, many: string): string =>
  `${String(n)} ${n === 1 ? one : many}`;

/** The panel's heading: the entries shown, and how many are dismissed. */
export const unmappedHeading = (shown: number, dismissed: number): string =>
  [
    plural(shown, 'unmapped run', 'unmapped runs'),
    ...(dismissed > 0 ? [`${String(dismissed)} dismissed`] : []),
  ].join(', ');

/** How many of the entries shown the form's pattern matches (dismissed
 * ones aren't counted, so the total agrees with the heading). */
export const matchesText = (matches: number, entries: number): string =>
  `Matches ${String(matches)} of the ${plural(entries, 'entry', 'entries')} shown.`;

/** What hides a dismissed entry. */
export const hiddenBy = (pattern: string): string => `Dismissed by ${pattern}`;

/** Where an entry was read, and its branch. */
export const whereText = (run: UnmappedRun): string =>
  run.branch ? `${run.where} · ${run.branch}` : run.where;
