/**
 * Zoom rules (spec.md C-13): zoom is a multiple of the Fit size (1 = the
 * whole board fits the viewport), stepped by buttons, keys and double-tap,
 * continuous for wheel and pinch, and reset to Fit when the board's size
 * changes. Pure.
 *
 * @module
 */

/** Fit; nothing smaller is offered (the board already fits). */
export const MIN_ZOOM = 1;
/** Large enough for a 40 x 8 board on a phone to reach full detail. */
export const MAX_ZOOM = 8;
/** One button, key or double-tap step. */
const STEP = 1.25;

/** radash has no clamp; this is the one place zoom is bounded. */
export const clampZoom = (zoom: number): number =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/** One step in or out; steps snap to Fit near the bottom. */
export function stepZoom(zoom: number, direction: 1 | -1): number {
  const next = clampZoom(direction > 0 ? zoom * STEP : zoom / STEP);
  return next < MIN_ZOOM * 1.05 ? MIN_ZOOM : next;
}

/** Continuous zoom from a wheel delta (negative = zoom in). */
export const wheelZoom = (zoom: number, deltaY: number): number =>
  clampZoom(zoom * Math.exp(-deltaY / 300));

/** The size key that, when it changes, resets zoom to Fit. */
export const boardSizeKey = (rows: number, stages: number): string =>
  `${String(rows)}x${String(stages)}`;

/** The saved zoom, or Fit if it was saved for a different board size. */
export const restoredZoom = (
  saved: { zoom: number; boardSize?: string },
  sizeKey: string,
): number => (saved.boardSize === sizeKey ? clampZoom(saved.zoom) : MIN_ZOOM);
