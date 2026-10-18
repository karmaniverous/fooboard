/**
 * The footer's form as it narrows (spec.md C-19): every item as text, then
 * as icons, then icons dropping out from the left; the legal items never
 * go. Pure, so it is tested without a browser.
 *
 * @module
 */

/** `gap-1` (icons) in px; `gap-6` between the sides. */
const ICON_GAP_PX = 4;
const SIDE_GAP_PX = 24;

/** The footer's form: -1 for every item as text, else icons with the
 * first n (non-legal) items dropped. A number, so an unchanged form never
 * re-renders. */
export type FooterForm = number;

/**
 * The richest form that fits `room` beside the copyright: text, then
 * icons, then icons dropping from the left; never the legal items.
 */
export function footerForm(
  room: number,
  copyright: number,
  textWidth: number,
  iconWidths: readonly number[],
  legalCount: number,
): FooterForm {
  const space = room - copyright - SIDE_GAP_PX;
  if (textWidth <= space) return -1;
  const droppable = iconWidths.length - legalCount;
  for (let dropped = 0; dropped < droppable; dropped++) {
    const shown = iconWidths.slice(dropped);
    const width =
      shown.reduce((a, b) => a + b, 0) + (shown.length - 1) * ICON_GAP_PX;
    if (width <= space) return dropped;
  }
  return droppable;
}
