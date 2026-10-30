/**
 * The README's screenshots (`docs/screenshots/`), as `npm run screenshots`
 * takes them: each shot's name and size, taken once per colour scheme as
 * `<name>-<scheme>.png`. `shots.test.ts` checks this list against the
 * README's image references and the committed PNGs, so a shot can't be
 * added to or dropped from one without the other.
 *
 * Pure data: the views themselves are in `take.shots.ts`, keyed by name.
 *
 * @module
 */

/** A rectangle in CSS px (one CSS px is one image px: scale factor 1). */
export interface Size {
  width: number;
  height: number;
}

/** One README screenshot. */
export interface Shot {
  /** The file name before `-<scheme>.png`. */
  name: string;
  /** The browser's viewport. */
  viewport: Size;
  /** The image's size when it is cropped from the viewport's top left;
   * the whole viewport when absent. */
  clip?: Size;
}

/** The colour schemes every shot is taken in. */
export const SCHEMES = ['light', 'dark'] as const;

/** The README's desktop viewport. */
const DESKTOP: Size = { width: 1440, height: 900 };

/** The board's design viewport (`DEMO_VIEWPORT`, as in
 * `playwright.config.ts`): the README's hero shot. */
const HERO: Size = { width: 1920, height: 950 };

export const SHOTS = [
  { name: 'demo', viewport: HERO },
  { name: 'home', viewport: DESKTOP },
  { name: 'board', viewport: DESKTOP },
  { name: 'editor', viewport: DESKTOP },
  { name: 'settings-editor', viewport: DESKTOP },
  { name: 'row-popup', viewport: DESKTOP, clip: { width: 414, height: 729 } },
  { name: 'credentials', viewport: DESKTOP },
] as const satisfies readonly Shot[];

/** A shot's name. */
export type ShotName = (typeof SHOTS)[number]['name'];

/** Every file the shots write, `<name>-<scheme>.png`. */
export const shotFiles = (): string[] =>
  SHOTS.flatMap(({ name }) => SCHEMES.map((scheme) => `${name}-${scheme}.png`));
