/**
 * Tests that the theme tokens in `index.css` keep their contrast in light
 * and dark mode: borders and field outlines at least 3:1 against the
 * surfaces they sit on (WCAG 2.2 SC 1.4.11, non-text contrast), and muted
 * text at least 4.5:1 (SC 1.4.3). The tokens are parsed from the CSS, so
 * a change that fades them fails here.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import css from './index.css?raw';

/** WCAG minimum ratios. */
const NON_TEXT = 3;
const TEXT = 4.5;

/** sRGB to relative luminance (WCAG 2.2, "relative luminance"). */
const CHANNEL_MAX = 255;
const LINEAR_THRESHOLD = 0.04045;
const LINEAR_DIVISOR = 12.92;
const GAMMA_OFFSET = 0.055;
const GAMMA_DIVISOR = 1.055;
const GAMMA = 2.4;
const WEIGHTS = [0.2126, 0.7152, 0.0722] as const;
/** The flare term added to both luminances in a contrast ratio. */
const FLARE = 0.05;

const HEX_COLOUR = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const HEX_RADIX = 16;

function luminance(hex: string): number {
  const match = HEX_COLOUR.exec(hex);
  if (!match) throw new Error(`not a #rrggbb colour: ${hex}`);
  return match.slice(1).reduce((sum, part, i) => {
    const c = parseInt(part, HEX_RADIX) / CHANNEL_MAX;
    const linear =
      c <= LINEAR_THRESHOLD
        ? c / LINEAR_DIVISOR
        : ((c + GAMMA_OFFSET) / GAMMA_DIVISOR) ** GAMMA;
    return sum + WEIGHTS[i] * linear;
  }, 0);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + FLARE) / (lo + FLARE);
}

/** The custom properties declared in the first block opened by `selector`. */
function tokens(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no ${selector} block`);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [
      m[1],
      m[2].trim(),
    ]),
  );
}

const light = tokens(':root');
/** Dark mode overrides some tokens; the rest are the light ones. */
const dark = { ...light, ...tokens('.dark') };
const MODES = { light, dark } as const;

/** Surfaces that borders and muted text are drawn on. */
const SURFACES = ['background', 'muted', 'popover', 'chrome'] as const;

const token = (mode: Record<string, string>, name: string): string => {
  if (!(name in mode)) throw new Error(`no --${name}`);
  return mode[name];
};

describe.each(Object.entries(MODES))('%s theme contrast', (_, mode) => {
  it.each(SURFACES)('borders reach 3:1 on %s', (surface) => {
    expect(
      contrast(token(mode, 'border'), token(mode, surface)),
    ).toBeGreaterThanOrEqual(NON_TEXT);
  });

  it.each(SURFACES)('muted text reaches 4.5:1 on %s', (surface) => {
    expect(
      contrast(token(mode, 'muted-foreground'), token(mode, surface)),
    ).toBeGreaterThanOrEqual(TEXT);
  });
});

describe('contrast', () => {
  it('matches the WCAG extremes', () => {
    const black = '#000000';
    const white = '#ffffff';
    const maxRatio = 21;
    expect(contrast(black, white)).toBeCloseTo(maxRatio);
    expect(contrast(white, white)).toBe(1);
  });
});
