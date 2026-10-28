/**
 * Shared board-grid styles: the board's text and gear sizes, its smaller
 * texts' sizes (`boardText`), group label text, and the stacking of the
 * group frames against the pinned headers (spec.md §3.7).
 *
 * @module
 */
import {
  BADGE_BORDER_PX,
  BADGE_PAD_X_EM,
  LABEL_TRACKING_EM,
  TEXT_ROLES,
  type TextRole,
} from './boardText';
import { type Layout, LINE_HEIGHT } from './layout';
import {
  HEADER_GEAR_GAP,
  SETTINGS_GEAR_INSET,
  SETTINGS_GEAR_SIZE,
} from './settingsGearSize';

/** The custom property carrying a smaller text's size. */
const textVar = (role: TextRole) => `--text-${role}`;

/** A smaller text's size (`boardText`), from the layout's, set around the
 * grid by `boardTextStyle`. */
export const textSize = (role: TextRole): React.CSSProperties => ({
  fontSize: `var(${textVar(role)})`,
});

/** The board's text size, its smaller texts' sizes and its settings
 * gears' sizes (spec.md §3.11), in ems of the text so they scale with
 * zoom: set around the grid, so the grid and the cell gear beside it
 * share them. */
export const boardTextStyle = (layout: Layout): React.CSSProperties =>
  ({
    fontSize: `${String(layout.fontPx)}px`,
    lineHeight: LINE_HEIGHT,
    '--gear-size': `${String(SETTINGS_GEAR_SIZE * layout.fontPx)}px`,
    '--gear-inset': `${String(SETTINGS_GEAR_INSET * layout.fontPx)}px`,
    '--gear-gap': `${String(HEADER_GEAR_GAP * layout.fontPx)}px`,
    ...Object.fromEntries(
      TEXT_ROLES.map((role) => [
        textVar(role),
        `${String(layout.textEm[role])}em`,
      ]),
    ),
  }) as React.CSSProperties;

/** Group label text, over columns and above rows (C-14b): its size and
 * letter spacing in `GROUP_LABEL_STYLE`, as the layout measures it. */
export const GROUP_LABEL = 'font-semibold uppercase text-muted-foreground';
export const GROUP_LABEL_STYLE: React.CSSProperties = {
  ...textSize('label'),
  letterSpacing: `${String(LABEL_TRACKING_EM)}em`,
};

/** A badge's size, padding and border, as the layout measures it. */
export const BADGE_STYLE: React.CSSProperties = {
  ...textSize('badge'),
  paddingInline: `${String(BADGE_PAD_X_EM)}em`,
  borderWidth: BADGE_BORDER_PX,
};

/** The background carried down through the gap below a pinned box. */
const GAP_BELOW =
  'after:absolute after:inset-x-0 after:top-full after:h-[var(--grid-gap)] after:bg-background';

/** Z-order (spec.md §3.7): the pinned stage headers and the label strip
 * sit at `z-20`, the pinned corners at `z-30`, the app header at `z-40`.
 * A column group's frame (`FRAME_LAYER`) is drawn over the pinned top
 * headers, so its top line shows on the strip or the headers it runs
 * along, while what is pinned at the left (row names, row-group labels;
 * `PIN_ABOVE_FRAMES`) covers it when the board scrolls right. Pinned top
 * and pinned left meet only at the corners, which stay over both. */
export const FRAME_LAYER = 'z-[21]';
export const PIN_ABOVE_FRAMES = 'z-[22]';

/** Pinned at the top while the board scrolls down (C-13): the label
 * strip below the app header, the stage headers below the strip (its
 * height, `--strip-h`, when there is one). */
export const PIN_TOP_STRIP =
  'sticky top-[var(--app-header-h,0px)] z-20 bg-background';
export const PIN_TOP =
  'sticky top-[calc(var(--app-header-h,0px)+var(--strip-h,0px))] z-20 bg-background';

/** Pinned at the left while the board scrolls right (C-13), over the
 * frames, with a block of background one gap tall below it (`::after`),
 * so no frame shows through the pinned column between its rows. A solid
 * block, not a shadow: forced colours drop shadows. */
export const PIN_LEFT = `sticky left-0 ${PIN_ABOVE_FRAMES} bg-background ${GAP_BELOW}`;
