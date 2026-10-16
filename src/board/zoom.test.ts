/**
 * Tests for the zoom rules: steps clamp and snap to Fit, wheel zoom is
 * bounded, and a saved zoom is restored only for the same board size.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import {
  boardSizeKey,
  MAX_ZOOM,
  restoredZoom,
  stepZoom,
  wheelZoom,
} from './zoom';

describe('stepZoom', () => {
  it('steps in, back out to exactly Fit, and stops at the bounds', () => {
    expect(stepZoom(1, 1)).toBe(1.25);
    expect(stepZoom(1.25, -1)).toBe(1);
    expect(stepZoom(1, -1)).toBe(1);
    expect(stepZoom(MAX_ZOOM, 1)).toBe(MAX_ZOOM);
  });
});

describe('wheelZoom', () => {
  it('zooms in on a negative delta and never below Fit', () => {
    expect(wheelZoom(1, -100)).toBeGreaterThan(1);
    expect(wheelZoom(1, 500)).toBe(1);
  });
});

describe('restoredZoom', () => {
  it('restores zoom only for the board size it was saved for', () => {
    const key = boardSizeKey(19, 6);
    expect(restoredZoom({ zoom: 2, boardSize: key }, key)).toBe(2);
    expect(restoredZoom({ zoom: 2, boardSize: '20x6' }, key)).toBe(1);
    expect(restoredZoom({ zoom: 2 }, key)).toBe(1);
  });
});
