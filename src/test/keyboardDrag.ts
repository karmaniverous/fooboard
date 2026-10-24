/**
 * Test helpers for dnd-kit sortable lists: reorder from the keyboard, as
 * a user can (Space on the drag handle, arrow keys, Space again). jsdom
 * doesn't lay out, so while a drag runs each list item gets a rect from
 * its position among its siblings, which the keyboard sensor measures.
 *
 * @module
 */
import { act, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

import { focusElement } from './focus';

/** The laid-out size of a list item, and the gap between items. */
const ITEM_HEIGHT = 40;
const ITEM_GAP = 8;
const ITEM_WIDTH = 300;

/** How far apart list items sit: one keyboard step moves a drag this far. */
export const ITEM_PITCH = ITEM_HEIGHT + ITEM_GAP;

function rectAt(top: number): DOMRect {
  return {
    x: 0,
    y: top,
    top,
    left: 0,
    width: ITEM_WIDTH,
    height: ITEM_HEIGHT,
    right: ITEM_WIDTH,
    bottom: top + ITEM_HEIGHT,
    toJSON: () => ({}),
  };
}

/** Give every element the rect of the list item holding it (outside
 * the list, e.g. the drag overlay: the dragged item's); returns the
 * restore. */
function layOutListItems(): () => void {
  const spy = vi
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: Element) {
      const li =
        this.closest('li') ?? document.querySelector('li[data-dragging]');
      const index = li?.parentElement
        ? [...li.parentElement.children].indexOf(li)
        : 0;
      return rectAt(index * ITEM_PITCH);
    });
  return () => {
    spy.mockRestore();
  };
}

/** Let the sensor's deferred listeners attach and React render. */
const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

/** A keyboard drag in progress: move it, then drop or cancel it. */
export interface KeyboardDrag {
  move: (direction: 'up' | 'down') => Promise<void>;
  drop: () => Promise<void>;
}

/** Pick up the item whose drag handle is `handle`. */
export async function startKeyboardDrag(
  handle: HTMLElement,
): Promise<KeyboardDrag> {
  const restore = layOutListItems();
  focusElement(handle);
  fireEvent.keyDown(handle, { code: 'Space', key: ' ' });
  await settle();
  return {
    move: async (direction) => {
      fireEvent.keyDown(handle, {
        code: direction === 'up' ? 'ArrowUp' : 'ArrowDown',
      });
      await settle();
    },
    drop: async () => {
      fireEvent.keyDown(handle, { code: 'Space', key: ' ' });
      await settle();
      restore();
    },
  };
}

/** Move the item whose drag handle is `handle` by `steps` (negative: up)
 * and drop it. */
export async function keyboardDrag(
  handle: HTMLElement,
  steps: number,
): Promise<void> {
  const drag = await startKeyboardDrag(handle);
  for (let i = 0; i < Math.abs(steps); i++)
    await drag.move(steps < 0 ? 'up' : 'down');
  await drag.drop();
}
