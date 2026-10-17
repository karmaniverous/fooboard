/**
 * Text measurement for the board layout (spec.md C-13), via a canvas in
 * the board's font at semibold weight (the widest the board uses), cached
 * per text and size. Where there is no canvas (tests), an estimate of
 * 0.6 em per character stands in.
 *
 * @module
 */
import type { Measure } from './layout';

const ESTIMATE_EM_PER_CHAR = 0.6;

const estimateMeasure: Measure = (text, fontPx) =>
  text.length * fontPx * ESTIMATE_EM_PER_CHAR;

/** A canvas measure in the document's font, or the estimate. */
export function createTextMeasure(): Measure {
  const usable =
    typeof document !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    !navigator.userAgent.includes('jsdom');
  const context = usable
    ? document.createElement('canvas').getContext('2d')
    : null;
  if (!context) return estimateMeasure;
  const family = getComputedStyle(document.body).fontFamily || 'sans-serif';
  const cache = new Map<string, number>();
  return (text, fontPx) => {
    const key = `${String(fontPx)}|${text}`;
    let width = cache.get(key);
    if (width === undefined) {
      context.font = `600 ${String(fontPx)}px ${family}`;
      width = context.measureText(text).width;
      cache.set(key, width);
    }
    return width;
  };
}
