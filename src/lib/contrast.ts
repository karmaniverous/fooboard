/**
 * Text colour on a coloured fill (spec.md A§4.3.6): white or near-black,
 * whichever has the higher WCAG contrast ratio against the fill, so no
 * status needs its own text colour setting.
 *
 * @module
 */

/** Near-black text: the board's slate-900. */
export const DARK_TEXT = '#0f172a';

const channel = (c: number): number => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance of a `#rrggbb` colour. */
export function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two luminances. */
export const contrast = (a: number, b: number): number =>
  (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** White or near-black, whichever reads better on `fill`. */
export function textOn(fill: string): string {
  const l = luminance(fill);
  return contrast(l, 1) >= contrast(l, luminance(DARK_TEXT))
    ? '#ffffff'
    : DARK_TEXT;
}
