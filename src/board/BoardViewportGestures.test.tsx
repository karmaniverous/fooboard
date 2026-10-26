/**
 * Tests for the board viewport's gestures (spec.md C-13): Ctrl/Cmd + wheel
 * zooms in steps (small deltas adding up), a plain wheel scrolls; `=` and
 * `-` zoom on the focused board and other keys pass through; a pinch
 * zooms by the change in distance between two pointers; a double tap
 * zooms in a step; a drag pans the page only when the board overflows;
 * and a cancelled press never swallows the next click.
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

  it('zooms by the change in distance between two pointers, and not from a pinch of no width', () => {
    const stores = renderViewport();
    const board = boardArea();
    const down = (pointerId: number, clientX: number) => {
      fireEvent.pointerDown(board, { pointerId, clientX, clientY: 0 });
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

  it('zooms in a step on a double tap, not on two taps further apart', () => {
    const stores = renderViewport();
    const board = boardArea();
    // jsdom stamps events with the real clock: set each tap's stamp.
    const tap = (pointerId: number, timeStamp: number) => {
      const down = createEvent.pointerDown(board, {
        pointerId,
        pointerType: 'touch',
      });
      Object.defineProperty(down, 'timeStamp', { value: timeStamp });
      fireEvent(board, down);
      fireEvent.pointerUp(board, { pointerId, pointerType: 'touch' });
    };
    tap(1, 1000);
    tap(2, 1200);
    expect(zoomOf(stores)).toBe(1.1);
    tap(3, 5000);
    tap(4, 9000);
    expect(zoomOf(stores)).toBe(1.1);
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

  it('pans the page by the drag only when the board overflows', () => {
    renderViewport(model);
    const scroll = vi
      .spyOn(window, 'scrollBy')
      .mockImplementation(() => undefined);
    const board = boardArea();
    const drag = (pointerId: number) => {
      fireEvent.pointerDown(board, { pointerId, clientX: 200, clientY: 200 });
      fireEvent.pointerMove(board, { pointerId, clientX: 150, clientY: 160 });
      fireEvent.pointerUp(board, { pointerId });
    };
    // At 100% the demo board fits the test window: nothing to pan.
    drag(1);
    expect(scroll).not.toHaveBeenCalled();
    magnify();
    drag(2);
    expect(scroll).toHaveBeenCalledWith(50, 40);
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
