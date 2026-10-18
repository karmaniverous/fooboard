/**
 * The footer's form as it narrows (spec.md C-19): every item as text, then
 * as icons, then icons dropping out from the left; the legal items never
 * go. Pure, so it is tested without a browser.
 *
 * @module
 */

/** The footer's form: -1 for every item as text, else icons with the
 * first n (non-legal) items dropped. A number, so an unchanged form never
 * re-renders. */
export type FooterForm = number;

/**
 * The richest form that fits `space` (the room beside the copyright):
 * text, then icons, then icons dropping from the left, never the last
 * `legalCount`. The icon row is given as laid out: each icon's start from
 * the row's left edge, and the row's width, so its gaps are included.
 */
export function footerForm(
  space: number,
  textWidth: number,
  iconStarts: readonly number[],
  rowWidth: number,
  legalCount: number,
): FooterForm {
  if (textWidth <= space) return -1;
  const droppable = iconStarts.length - legalCount;
  for (let dropped = 0; dropped < droppable; dropped++)
    if (rowWidth - (iconStarts[dropped] ?? 0) <= space) return dropped;
  return droppable;
}
