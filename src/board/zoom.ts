/**
 * Board zoom (spec.md C-13): one scale, in 10% steps, saved as a single
 * number. Below 1: text scale, down to 50% (lower, to 25%, only as far as
 * columns need to fit across). Above 1: a height budget at 13 px until the
 * top rung fits; beyond that, plain magnification up to 300% text. The value
 * is a zoom position, not a text size. Pure.
 *
 * @module
 */

import { BASE_FONT_PX } from './boardText';
import {
  fitLayout,
  type Layout,
  layoutAtRung,
  type LayoutInput,
  TOP_RUNG,
} from './layout';

const MAX_MAGNIFY = 3;
const USUAL_MIN = 0.5;
const FLOOR = 0.25;

/** Where zoom can go for one board in one grid area. */
export interface ZoomRange {
  min: number;
  /** The zoom at which the top rung fits; magnification starts above it. */
  top: number;
  max: number;
}

const round = (z: number) => Math.round(z * 100) / 100;

/** The lowest zoom: 50%, or lower (to 25%) only as far as columns need to
 * fit across the grid area. */
function minZoom(input: LayoutInput): number {
  const fitsAt = (z: number) => !fitLayout(input, BASE_FONT_PX * z).overflowX;
  if (fitsAt(USUAL_MIN)) return USUAL_MIN;
  if (!fitsAt(FLOOR)) return FLOOR;
  let lo = FLOOR;
  let hi = USUAL_MIN;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    if (fitsAt(mid)) lo = mid;
    else hi = mid;
  }
  return Math.floor(lo * 100) / 100;
}

/** Width is the constraint when even rung 1 cannot fit across at 100%:
 * then zooming in may widen the board too, or it could never add detail. */
const widthBound = (input: LayoutInput) =>
  layoutAtRung(input, 1, BASE_FONT_PX).overflowX;

/** The budget's base: the board at 100%, never smaller than the grid area.
 * Zooming in multiplies it, so each step buys room relative to what the
 * board already needs (C-13). */
function budgetBase(input: LayoutInput) {
  const at100 = fitLayout(input, BASE_FONT_PX);
  return {
    height: Math.max(input.height, at100.boardHeight),
    width: Math.max(input.width, at100.boardWidth),
  };
}

export function zoomRange(input: LayoutInput): ZoomRange {
  const full = layoutAtRung(input, TOP_RUNG, BASE_FONT_PX);
  const base = budgetBase(input);
  const ratio = Math.max(
    full.boardHeight / Math.max(1, base.height),
    widthBound(input) ? full.boardWidth / Math.max(1, base.width) : 1,
  );
  const top = Math.max(1, Math.ceil(ratio * 10 - 1e-9) / 10);
  return { min: minZoom(input), top, max: round(top * MAX_MAGNIFY) };
}

const clampZoom = (zoom: number, range: ZoomRange): number =>
  Math.min(range.max, Math.max(range.min, zoom));

/** The layout at a zoom value (clamped to the board's range). */
export function layoutAtZoom(
  input: LayoutInput,
  zoom: number,
  range: ZoomRange = zoomRange(input),
): Layout {
  const z = clampZoom(zoom, range);
  if (z <= 1) return fitLayout(input, BASE_FONT_PX * z);
  if (z <= range.top) {
    // The budget: z times the board's height at 100% (at least the grid
    // area), and its width too when width is what limits detail (C-13).
    const base = budgetBase(input);
    return fitLayout(
      {
        ...input,
        height: base.height * z,
        width: widthBound(input) ? base.width * z : input.width,
      },
      BASE_FONT_PX,
    );
  }
  return layoutAtRung(
    input,
    TOP_RUNG,
    Math.round(BASE_FONT_PX * Math.min(MAX_MAGNIFY, z / range.top) * 100) / 100,
  );
}

/** One 10% step in or out, landing on the 10% grid. */
export function stepZoom(
  zoom: number,
  direction: 1 | -1,
  range: ZoomRange,
): number {
  const tenths = zoom * 10;
  const next =
    direction > 0
      ? Math.floor(tenths + 1e-6) + 1
      : Math.ceil(tenths - 1e-6) - 1;
  return round(clampZoom(next / 10, range));
}

/** A typed or pinched zoom, snapped to 10% and clamped. */
export const snapZoom = (zoom: number, range: ZoomRange): number =>
  round(clampZoom(Math.round(zoom * 10) / 10, range));

/** What the zoom control shows: a percentage, the zoom position (C-13). */
export const zoomLabel = (zoom: number, range: ZoomRange): string =>
  `${String(Math.round(clampZoom(zoom, range) * 100))}%`;
