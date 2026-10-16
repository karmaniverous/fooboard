/**
 * Tests for tooltip placement: below when it fits, flipped above near the
 * bottom edge, capped to the larger side, and kept on screen horizontally.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { placeTooltip } from './placement';

const viewport = { width: 400, height: 800 };
const size = { width: 320, height: 200 };

describe('placeTooltip', () => {
  it('goes below a cell with room under it', () => {
    expect(
      placeTooltip({ left: 10, top: 100, bottom: 120 }, size, viewport),
    ).toEqual({ left: 10, top: 126, maxHeight: 668 });
  });

  it('flips above a bottom-row cell', () => {
    const p = placeTooltip({ left: 10, top: 760, bottom: 780 }, size, viewport);
    expect(p.top).toBe(760 - 6 - 200);
  });

  it('caps a tall tooltip to the larger side', () => {
    const p = placeTooltip(
      { left: 10, top: 300, bottom: 320 },
      { width: 320, height: 2000 },
      viewport,
    );
    expect(p).toMatchObject({ top: 326, maxHeight: 468 });
  });

  it('stays inside a narrow screen', () => {
    const p = placeTooltip(
      { left: 300, top: 100, bottom: 120 },
      size,
      viewport,
    );
    expect(p.left).toBe(400 - 320 - 6);
  });
});
