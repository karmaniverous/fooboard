/**
 * Tests for the board viewport's gestures (spec.md C-13): Ctrl/Cmd + wheel
 * zooms in steps (small deltas adding up), a plain wheel scrolls; `=` and
 * `-` zoom on the focused board and other keys pass through; a pinch
 * zooms by the change in distance between two pointers, and a two-finger
 * touch is kept from scrolling; a double tap zooms in a step, and a run of
 * flicks (touch scrolls, cancelled by the browser) never does; a mouse drag
 * pans the page only when the board overflows, while a touch drag is left
 * to the browser (`touch-action: pan-x pan-y`, Decision 76); and a
 * cancelled press never swallows the next click.
 *
 * @module
 */
import { createEvent, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { measureBoard } from '@/demo/scenarios/measure';
import type { BoardModel } from '@/engine';
import { fullModel } from '@/test/boardModel';
import { boardArea, renderViewport } from '@/test/boardViewport';

let model: BoardModel;
beforeAll(async () => {
  model = await fullModel(measureBoard);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const zoomOf = (stores: ReturnType<typeof renderViewport>) =>
  stores.preferences.getView('demo').zoom;

/** Dispatch a touchmove with `fingers` touches; false if prevented. */
const touchMove = (target: HTMLElement, fingers: number): boolean => {
  const move = new Event('touchmove', { bubbles: true, cancelable: true });
  Object.defineProperty(move, 'touches', { value: { length: fingers } });
  return target.dispatchEvent(move);
};

/** A touch pointer event stamped at `timeStamp` (jsdom stamps events with
 * the real clock). */
const touchAt = (
  target: HTMLElement,
  type: 'pointerDown' | 'pointerUp' | 'pointerCancel',
  pointerId: number,
  timeStamp: number,
  clientX = 20,
) => {
  const event = createEvent[type](target, {
    pointerId,
    pointerType: 'touch',
    clientX,
    clientY: 20,
  });
  Object.defineProperty(event, 'timeStamp', { value: timeStamp });
  fireEvent(target, event);
};

/** Magnify to the top of the range, so the board overflows the window. */
const magnify = () => {
  const field = screen.getByLabelText('Zoom');
  fireEvent.focus(field);
  fireEvent.change(field, { target: { value: '9999' } });
  fireEvent.keyDown(field, { key: 'Enter' });
};

describe('BoardViewport gestures', () => {
  it('zooms on Ctrl or Cmd + wheel in steps, adding small deltas, and leaves a plain wheel alone', () => {
    const stores = renderViewport();
    const board = boardArea();
    fireEvent.wheel(board, { deltaY: -200 });
    expect(zoomOf(stores)).toBe(1);
    fireEvent.wheel(board, { deltaY: -60, ctrlKey: true });
    expect(zoomOf(stores)).toBe(1.1);
    // A trackpad pinch: small deltas add up to a step.
    fireEvent.wheel(board, { deltaY: 30, metaKey: true });
    expect(zoomOf(stores)).toBe(1.1);
    fireEvent.wheel(board, { deltaY: 30, metaKey: true });
    expect(zoomOf(stores)).toBe(1);
  });

  it('zooms with = and -, and lets other keys through', () => {
    const stores = renderViewport();
    const board = boardArea();
    fireEvent.keyDown(board, { key: '=' });
    expect(zoomOf(stores)).toBe(1.1);
    fireEvent.keyDown(board, { key: '-' });
    fireEvent.keyDown(board, { key: '-' });
    expect(zoomOf(stores)).toBe(0.9);
    expect(fireEvent.keyDown(board, { key: 'x' })).toBe(true); // not prevented
    expect(zoomOf(stores)).toBe(0.9);
  });

  it('zooms by the change in distance between two pointers, keeps two fingers from scrolling, and not from a pinch of no width', () => {
    const stores = renderViewport();
    const board = boardArea();
    // The browser pans one finger; two it would pan too, cancelling the
    // pinch, so their moves are prevented.
    expect(touchMove(board, 1)).toBe(true);
    expect(touchMove(board, 2)).toBe(false);
    const down = (pointerId: number, clientX: number) => {
      fireEvent.pointerDown(board, {
        pointerId,
        pointerType: 'touch',
        clientX,
        clientY: 0,
      });
    };
    down(1, 0);
    down(2, 100);
    fireEvent.pointerMove(board, { pointerId: 2, clientX: 150, clientY: 0 });
    expect(zoomOf(stores)).toBe(1.5);
    fireEvent.pointerUp(board, { pointerId: 2 });
    fireEvent.pointerUp(board, { pointerId: 1 });

    down(3, 40);
    down(4, 40);
    fireEvent.pointerMove(board, { pointerId: 4, clientX: 90, clientY: 0 });
    expect(zoomOf(stores)).toBe(1.5);
  });

  it('zooms in a step on a double tap, not on taps further apart, moved or with two fingers', () => {
    const stores = renderViewport();
    const board = boardArea();
    // Taps count when they let go, where they went down.
    const tap = (pointerId: number, timeStamp: number, upX = 20) => {
      touchAt(board, 'pointerDown', pointerId, timeStamp - 50);
      touchAt(board, 'pointerUp', pointerId, timeStamp, upX);
    };
    tap(1, 1000);
    tap(2, 1200);
    expect(zoomOf(stores)).toBe(1.1);
    tap(3, 5000);
    tap(4, 9000);
    expect(zoomOf(stores)).toBe(1.1);
    // A touch that moved before letting go is no tap.
    tap(5, 12_000);
    tap(6, 12_100, 60);
    expect(zoomOf(stores)).toBe(1.1);
    // Nor is a two-finger tap (a pinch that didn't move).
    touchAt(board, 'pointerDown', 7, 15_000);
    touchAt(board, 'pointerDown', 8, 15_010, 25);
    touchAt(board, 'pointerUp', 8, 15_050, 25);
    touchAt(board, 'pointerUp', 7, 15_060);
    expect(zoomOf(stores)).toBe(1.1);
  });

  it('never zooms on a run of flicks, and a tap after a flick is a tap', () => {
    const stores = renderViewport(model);
    const cell = screen.getAllByRole('link', { name: /Passed, dev/ })[0];
    // A flick: the browser takes the touch to scroll and cancels it.
    const flick = (pointerId: number, timeStamp: number) => {
      touchAt(cell, 'pointerDown', pointerId, timeStamp);
      touchAt(cell, 'pointerCancel', pointerId, timeStamp + 30);
    };
    flick(1, 1000);
    flick(2, 1100);
    flick(3, 1200);
    expect(zoomOf(stores)).toBe(1);
    // A tap straight after a flick opens the cell and doesn't zoom.
    touchAt(cell, 'pointerDown', 4, 1300);
    touchAt(cell, 'pointerUp', 4, 1350);
    fireEvent.click(cell);
    expect(zoomOf(stores)).toBe(1);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('ignores a pointer it never saw go down', () => {
    const stores = renderViewport();
    const scroll = vi
      .spyOn(window, 'scrollBy')
      .mockImplementation(() => undefined);
    fireEvent.pointerMove(boardArea(), {
      pointerId: 9,
      clientX: 300,
      clientY: 300,
    });
    expect(scroll).not.toHaveBeenCalled();
    expect(zoomOf(stores)).toBe(1);
  });

  it('pans the page by a mouse drag only when the board overflows', () => {
    renderViewport(model);
    const scroll = vi
      .spyOn(window, 'scrollBy')
      .mockImplementation(() => undefined);
    const board = boardArea();
    const drag = (pointerId: number, pointerType = 'mouse') => {
      const at = (clientX: number, clientY: number) => ({
        pointerId,
        pointerType,
        clientX,
        clientY,
      });
      fireEvent.pointerDown(board, at(200, 200));
      fireEvent.pointerMove(board, at(150, 160));
      fireEvent.pointerUp(board, at(150, 160));
    };
    // At 100% the demo board fits the test window: nothing to pan.
    drag(1);
    expect(scroll).not.toHaveBeenCalled();
    magnify();
    drag(2);
    expect(scroll).toHaveBeenCalledWith(50, 40);
  });

  it('leaves a touch drag to the browser: the grid pans natively and the code never scrolls', () => {
    renderViewport(model);
    const scroll = vi
      .spyOn(window, 'scrollBy')
      .mockImplementation(() => undefined);
    const board = boardArea();
    expect(board).toHaveClass('touch-pan-x', 'touch-pan-y');
    expect(board).not.toHaveClass('touch-none');
    magnify();
    const touch = { pointerId: 1, pointerType: 'touch' };
    fireEvent.pointerDown(board, { ...touch, clientX: 200, clientY: 200 });
    fireEvent.pointerMove(board, { ...touch, clientX: 150, clientY: 160 });
    fireEvent.pointerMove(board, { ...touch, clientX: 100, clientY: 120 });
    fireEvent.pointerUp(board, touch);
    expect(scroll).not.toHaveBeenCalled();
  });

  it('swallows the click that ends a drag, but never the one after a cancelled press', () => {
    renderViewport(model);
    vi.spyOn(window, 'scrollBy').mockImplementation(() => undefined);
    magnify();
    const cell = screen.getAllByRole('link', { name: /Passed, dev/ })[0];
    const reached = vi.fn();
    document.addEventListener('click', reached);
    try {
      const press = (pointerId: number) => {
        fireEvent.pointerDown(cell, { pointerId, clientX: 200, clientY: 200 });
        fireEvent.pointerMove(cell, { pointerId, clientX: 100, clientY: 100 });
      };
      press(1);
      fireEvent.pointerUp(cell, { pointerId: 1 });
      fireEvent.click(cell);
      expect(reached).not.toHaveBeenCalled();
      press(2);
      fireEvent.pointerCancel(cell, { pointerId: 2 });
      fireEvent.click(cell);
      expect(reached).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener('click', reached);
    }
  });
});
