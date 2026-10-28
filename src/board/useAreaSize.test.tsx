/**
 * Tests for the grid area (spec.md C-13; Decision 76): the height comes
 * from the small viewport height (the `100svh` probe), not the window's
 * height that iOS's address bar changes during a scroll; on a touch-first
 * device a height change alone never re-lays out, a width or orientation
 * change does; on a desktop every resize still counts.
 *
 * @module
 */
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { type FakeMediaQueries, fakeMediaQueries } from '@/test/mediaQuery';
import { type FakeWindowSize, fakeWindowSize } from '@/test/windowSize';

import { useAreaSize } from './useAreaSize';

const COARSE = '(pointer: coarse)';
const LANDSCAPE = '(orientation: landscape)';
/** The page's margin below the grid (px). */
const MARGIN = 8;

let media: FakeMediaQueries | undefined;
let size: FakeWindowSize;

/** An element whose box is `height` tall (0: not measurable). */
const box = (height: number): HTMLElement => {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => new DOMRect(0, 0, 0, height);
  return el;
};

/** The hook over a grid at the page's top, first measured (the test
 * DOM's ResizeObserver never calls back); `svh` is the probe's height. */
function measure(svh = 0) {
  const grid = { current: document.createElement('div') };
  const probe = { current: box(svh) };
  const hook = renderHook(() => useAreaSize(grid, probe));
  size.resize({});
  return hook;
}

/** Which media queries match: a touch-first device, and the orientation. */
const device = ({ coarse = false, landscape = false }) => {
  const matching = (q: string) =>
    (q === COARSE && coarse) || (q === LANDSCAPE && landscape);
  if (media) media.set(matching);
  else media = fakeMediaQueries(matching);
};

beforeEach(() => {
  size = fakeWindowSize();
  size.resize({ width: 390, height: 844 });
});

afterEach(() => {
  media?.restore();
  media = undefined;
  size.restore();
});

describe('useAreaSize', () => {
  it('takes the height from the small viewport height, not the window height', () => {
    device({});
    const { result } = measure(700);
    expect(result.current).toEqual({ width: 390, height: 700 - MARGIN });
    // The address bar collapses: the window grows, 100svh doesn't.
    size.resize({ height: 900 });
    expect(result.current.height).toBe(700 - MARGIN);
  });

  it('keeps the height on a touch device when only the height changes, so a scroll never re-lays out', () => {
    device({ coarse: true });
    // No svh (or a browser where it moves): the window height is the
    // fallback, and still a height change alone is ignored.
    const { result } = measure();
    const first = result.current;
    expect(first).toEqual({ width: 390, height: 844 - MARGIN });
    size.resize({ height: 760 });
    size.resize({ height: 900 });
    expect(result.current).toBe(first);
  });

  it('re-lays out on a touch device when the width or the orientation changes', () => {
    device({ coarse: true });
    const { result } = measure();
    size.resize({ width: 844, height: 360 });
    expect(result.current).toEqual({ width: 844, height: 360 - MARGIN });
    // An orientation change that keeps the width (a split view).
    size.resize({ height: 900 });
    expect(result.current.height).toBe(360 - MARGIN);
    device({ coarse: true, landscape: true });
    size.resize({});
    expect(result.current.height).toBe(900 - MARGIN);
  });

  it('follows every resize on a desktop, height alone included', () => {
    device({});
    const { result } = measure();
    size.resize({ width: 1920, height: 950 });
    expect(result.current).toEqual({ width: 1920, height: 950 - MARGIN });
    size.resize({ height: 700 });
    expect(result.current).toEqual({ width: 1920, height: 700 - MARGIN });
  });

  it('leaves out a scrollbar a modal has hidden', () => {
    device({});
    document.body.style.setProperty('--removed-body-scroll-bar-size', '15px');
    try {
      const { result } = measure();
      expect(result.current.width).toBe(390 - 15);
    } finally {
      document.body.style.removeProperty('--removed-body-scroll-bar-size');
    }
  });
});
