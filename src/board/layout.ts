/**
 * Board layout (spec.md C-13): lay the grid, then choose the richest
 * detail rung that fits, packing each cell's items into lines. Pure: text
 * is measured through an injected function, so the rules are tested
 * without a browser.
 *
 * - **Detail rungs**: 0 status icon and badge; 1 + status label; 2 +
 *   relative time; 3 + short commit (badge after it) and phase; 4 +
 *   branch; 5 + commit message.
 * - **Packing**: the lead (icon, label, badge) has the first line; when
 *   everything fits on it, the board is one line per cell. Otherwise the
 *   items fill the following lines left to right, each in a slot sized for
 *   its longest form, starting a new line only when the next will not fit.
 *   Free text (branch, message) needs only a few characters and is cut off.
 * - **One arrangement for every cell**: the line breaks are chosen once
 *   for the board, from its most demanding contents (cells, empty cells,
 *   stage headers and group labels).
 *
 * @module
 */
import type { Density } from '@/domain/config/devicePreferences';

export type Rung = 0 | 1 | 2 | 3 | 4 | 5;
const TOP_RUNG: Rung = 5;
const RUNGS_DOWN: readonly Rung[] = [5, 4, 3, 2, 1, 0];

/** The items a cell can show after its lead, in display order. */
export type ItemKey =
  'time' | 'commit' | 'phase' | 'branch' | 'message' | 'extra';

/** One line per cell, or items packed onto lines after the lead's. */
type CellFormat = 'line' | 'packed';

/** Readable text at 100% zoom (C-13). */
export const BASE_FONT_PX = 13;
/** Line height, in ems. */
export const LINE_HEIGHT = 1.35;
/** Space between items on a line, in ems. */
export const ITEM_GAP_EM = 0.45;
/** Extra width for the badge around its text (padding and outline), in ems. */
const BADGE_EXTRA_EM = 1.1;
/** Free text (names, branches, messages) is cut off at this length. */
const FREE_TEXT_CAP = 40;
/** Free text needs room for at least this many characters. */
const FREE_TEXT_MIN_CHARS = 8;
/** The row-name column takes at most this share of the grid area. */
const ROW_NAME_SHARE = 0.3;
/** On phones (grid area narrower than this) the row-name column takes at
 * most a smaller share; names are cut off, full name in the title. */
const PHONE_WIDTH = 640;
const PHONE_ROW_NAME_SHARE = 0.18;

/** Density changes only padding and gaps (C-13). Padding in ems; gap in px. */
const DENSITY: Record<Density, { padX: number; padY: number; gap: number }> = {
  compact: { padX: 0.35, padY: 0.12, gap: 2 },
  default: { padX: 0.6, padY: 0.35, gap: 3 },
  comfortable: { padX: 0.9, padY: 0.6, gap: 5 },
};

/** Cut free text at the cap, with an ellipsis. */
export const capText = (text: string): string =>
  text.length > FREE_TEXT_CAP ? `${text.slice(0, FREE_TEXT_CAP - 1)}…` : text;

export interface Item {
  key: ItemKey;
  text: string;
  /** Free text: needs only a few characters, cut off with "…". */
  free?: boolean;
  /** A badge drawn after this item (the commit, from rung 3). */
  badge?: string;
}

/** What one box shows at a rung: the unbreakable lead (with an optional
 * badge), then items. */
export interface Content {
  /** Columns the box spans (group labels); its width is shared by them. */
  span?: number;
  lead: string;
  badge?: string;
  items: readonly Item[];
}

export type Measure = (text: string, fontPx: number) => number;

/** Which line each item sits on; line 0 is the lead's. */
export type LineMap = Partial<Record<ItemKey, number>>;

/** Widths of a content's lead and items at a text size. */
function widths(content: Content, fontPx: number, measure: Measure) {
  const gap = ITEM_GAP_EM * fontPx;
  const badge = (text?: string) =>
    text ? gap + measure(text, fontPx) + BADGE_EXTRA_EM * fontPx : 0;
  const freeMin = measure('x'.repeat(FREE_TEXT_MIN_CHARS), fontPx);
  return {
    gap,
    lead: measure(content.lead, fontPx) + badge(content.badge),
    items: content.items.map(
      (i) =>
        (i.free
          ? Math.min(measure(i.text, fontPx), freeMin)
          : measure(i.text, fontPx)) + badge(i.badge),
    ),
  };
}

/** The narrowest width a content can be packed into. */
export function minWidth(
  content: Content,
  fontPx: number,
  measure: Measure,
): number {
  const w = widths(content, fontPx, measure);
  return Math.max(w.lead, ...w.items) / Math.max(1, content.span ?? 1);
}

/** Pack a content into `width`: everything on one line if it fits, else
 * the lead alone, then items left to right across the following lines.
 * Returns null when the lead or an item cannot fit at all. */
export function packContent(
  content: Content,
  width: number,
  fontPx: number,
  measure: Measure,
): { oneLine: boolean; lines: number; lineOf: LineMap } | null {
  const span = Math.max(1, content.span ?? 1);
  const room = width * span;
  const w = widths(content, fontPx, measure);
  if (w.lead > room + 0.01) return null;
  const all = w.lead + w.items.reduce((sum, x) => sum + w.gap + x, 0);
  if (all <= room + 0.01) {
    const lineOf: LineMap = {};
    for (const i of content.items) lineOf[i.key] = 0;
    return { oneLine: true, lines: 1, lineOf };
  }
  if (w.items.some((x) => x > room + 0.01)) return null;
  const lineOf = greedy(content, w, room);
  const last = Math.max(0, ...Object.values(lineOf));
  return { oneLine: false, lines: last + 1, lineOf };
}

/** Fill items left to right from line 1, a new line when the next will
 * not fit. */
function greedy(
  content: Content,
  w: { gap: number; items: number[] },
  room: number,
): LineMap {
  const lineOf: LineMap = {};
  let line = 1;
  let used = 0;
  for (const [n, item] of content.items.entries()) {
    const x = w.items[n] ?? 0;
    const need = used > 0 ? w.gap + x : x;
    if (used > 0 && used + need > room + 0.01) {
      line += 1;
      used = x;
    } else {
      used += need;
    }
    lineOf[item.key] = line;
  }
  return lineOf;
}

/** Pack every content at one width, as one arrangement: one line only if
 * all fit on one; otherwise the breaks of the richest content apply to all.
 * Null when anything cannot fit. */
function packBoard(
  contents: readonly Content[],
  width: number,
  fontPx: number,
  measure: Measure,
): { format: CellFormat; lines: number; lineOf: LineMap } | null {
  const packs = [];
  for (const c of contents) {
    const p = packContent(c, width, fontPx, measure);
    if (!p) return null;
    packs.push({ c, p });
  }
  if (packs.every(({ p }) => p.oneLine)) {
    const lineOf: LineMap = {};
    for (const { p } of packs) Object.assign(lineOf, p.lineOf);
    return { format: 'line', lines: 1, lineOf };
  }
  // If one cell wraps, all wrap: every content is packed after the lead's
  // line, and the richest content's breaks win for shared items.
  const ordered = [...packs].sort(
    (a, b) => b.c.items.length - a.c.items.length,
  );
  const lineOf: LineMap = {};
  for (const { c } of ordered) {
    const room = width * Math.max(1, c.span ?? 1);
    const own = greedy(c, widths(c, fontPx, measure), room);
    for (const [k, v] of Object.entries(own)) lineOf[k as ItemKey] ??= v;
  }
  let lines = 1;
  for (const { c } of packs) {
    for (const i of c.items) lines = Math.max(lines, (lineOf[i.key] ?? 0) + 1);
  }
  return { format: 'packed', lines, lineOf };
}

export interface LayoutInput {
  /** The grid area (C-13), in px. */
  width: number;
  height: number;
  rows: number;
  stages: number;
  /** Extra one-line rows: the column group strip and labelled row dividers. */
  labelRows: number;
  rowNames: readonly string[];
  /** Everything that must fit one cell, at each rung. */
  contents: (rung: Rung) => readonly Content[];
  measure: Measure;
  density: Density;
}

export interface Layout {
  rung: Rung;
  format: CellFormat;
  /** The line each item sits on (line 0 is the lead's). */
  lineOf: LineMap;
  fontPx: number;
  rowNameWidth: number;
  colWidth: number;
  /** Height of every cell row. */
  rowHeight: number;
  /** Height of the header row and of label rows (one line). */
  lineRowHeight: number;
  gap: number;
  padX: number;
  padY: number;
  /** Columns are wider than the grid area allows: it scrolls right. */
  overflowX: boolean;
  /** The board is taller than the grid area: it scrolls down. */
  overflowY: boolean;
  /** The whole board's height, in px. */
  boardHeight: number;
}

/** Geometry shared by every layout at one text size. */
function frame(input: LayoutInput, fontPx: number) {
  const d = DENSITY[input.density];
  const padX = d.padX * fontPx;
  const padY = d.padY * fontPx;
  const longestName = Math.max(
    0,
    ...input.rowNames.map((n) => input.measure(capText(n), fontPx)),
  );
  const rowNameWidth = Math.min(
    (input.width < PHONE_WIDTH ? PHONE_ROW_NAME_SHARE : ROW_NAME_SHARE) *
      input.width,
    longestName + 2 * padX,
  );
  const stages = Math.max(1, input.stages);
  const colWidth = Math.max(
    0,
    Math.floor((input.width - rowNameWidth - d.gap * stages) / stages),
  );
  const lineRowHeight = LINE_HEIGHT * fontPx + 2 * padY;
  return { gap: d.gap, padX, padY, rowNameWidth, colWidth, lineRowHeight };
}

/** The layout for one rung: packed into the column width; if anything
 * cannot fit, columns widen to the narrowest width that holds it (the
 * board scrolls right). */
function layoutAtRung(input: LayoutInput, rung: Rung, fontPx: number): Layout {
  const f = frame(input, fontPx);
  const contents = input.contents(rung);
  const inner = f.colWidth - 2 * f.padX;
  let packed = packBoard(contents, inner, fontPx, input.measure);
  const overflowX = packed === null;
  let colWidth = f.colWidth;
  if (!packed) {
    const need = Math.ceil(
      Math.max(0, ...contents.map((c) => minWidth(c, fontPx, input.measure))),
    );
    colWidth = need + Math.ceil(2 * f.padX);
    packed = packBoard(contents, need, fontPx, input.measure) ?? {
      format: 'packed',
      lines: 1,
      lineOf: {},
    };
  }
  const rowHeight = packed.lines * LINE_HEIGHT * fontPx + 2 * f.padY;
  const total =
    (1 + input.labelRows) * (f.lineRowHeight + f.gap) +
    input.rows * (rowHeight + f.gap);
  return {
    rung,
    format: packed.format,
    lineOf: packed.lineOf,
    fontPx,
    rowNameWidth: f.rowNameWidth,
    colWidth,
    rowHeight,
    lineRowHeight: f.lineRowHeight,
    gap: f.gap,
    padX: f.padX,
    padY: f.padY,
    overflowX,
    overflowY: total > input.height + 0.5,
    boardHeight: total,
  };
}

/** Lay the grid, then choose (C-13): the richest rung that fits both
 * ways; else the board scrolls down as little as possible (the shortest
 * row height that fits the width), at the richest rung with that height;
 * columns overflow right only when rung 0 cannot fit. */
export function fitLayout(input: LayoutInput, fontPx: number): Layout {
  const all = RUNGS_DOWN.map((rung) => layoutAtRung(input, rung, fontPx));
  const fits = all.find((l) => !l.overflowX && !l.overflowY);
  if (fits) return fits;
  const across = all.filter((l) => !l.overflowX);
  if (across.length === 0) return layoutAtRung(input, 0, fontPx);
  const shortest = Math.min(...across.map((l) => l.rowHeight));
  return (
    across.find((l) => l.rowHeight <= shortest + 0.5) ??
    layoutAtRung(input, 0, fontPx)
  );
}

// --- Zoom (C-13): one scale, in 10% steps, saved as a single number. ----
// Below 1: text scale, down to 50% (lower, to 25%, only as far as columns
// need to fit across). Above 1: a height budget (the board may be zoom x
// the grid area's height) at 13 px, until the top rung fits; beyond that,
// plain magnification up to 300% text. The value is a zoom position, not a
// text size.

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

/** The board's width at a layout. */
const boardWidth = (input: LayoutInput, l: Layout) =>
  l.rowNameWidth + Math.max(1, input.stages) * (l.colWidth + l.gap);

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
    width: Math.max(input.width, boardWidth(input, at100)),
  };
}

export function zoomRange(input: LayoutInput): ZoomRange {
  const full = layoutAtRung(input, TOP_RUNG, BASE_FONT_PX);
  const base = budgetBase(input);
  const ratio = Math.max(
    full.boardHeight / Math.max(1, base.height),
    widthBound(input) ? boardWidth(input, full) / Math.max(1, base.width) : 1,
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
