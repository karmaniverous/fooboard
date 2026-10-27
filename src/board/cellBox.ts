/**
 * A board cell as a whole, as its tooltip sees it (spec.md §3.10,
 * §3.11, issue #42): the cell's box, which holds its control (the cover
 * link or button) and its behind/diverged badge, plus the cell gear while
 * it sits on that cell. The tooltip stays open while the pointer or focus
 * moves between these, and closes when it leaves them all.
 *
 * @module
 */
import { gearOwnerOf, gearTargetKey, gearTargetOf } from './cellGearTarget';
import type { CellFocus } from './cellView';

/** The attribute marking a cell's control: its cover link or button. */
export const CELL_CONTROL: Record<'data-cell-control', string> = {
  'data-cell-control': '',
};

/** A cell's control with focus (the box itself, for an empty cell). */
const FOCUSED_CONTROL = '[data-cell-control]:focus';

/** Whether focus (from the keyboard or a click) is on the control of
 * this cell box, so its keys work, rather than on its badge or anywhere
 * else. */
export const controlHasFocus = (box: Element): boolean =>
  box.matches(FOCUSED_CONTROL) || box.querySelector(FOCUSED_CONTROL) !== null;

/** Where focus is in a cell box (`CellFocus`): on its control, or on
 * its badge, the only other thing in the box that takes focus. */
export const cellFocus = (box: Element): CellFocus =>
  controlHasFocus(box)
    ? 'control'
    : box.contains(box.ownerDocument.activeElement)
      ? 'badge'
      : undefined;

/** Whether a node is in a cell as a whole: in its box (its control or its
 * badge), or on the cell gear sitting on it. */
export const withinCell = (
  box: Element,
  node: EventTarget | null | undefined,
): boolean => {
  if (!(node instanceof Element)) return false;
  if (box.contains(node)) return true;
  const cell = gearTargetOf(box);
  return cell !== null && gearOwnerOf(node) === gearTargetKey(cell);
};
