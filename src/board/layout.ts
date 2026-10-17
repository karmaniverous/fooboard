/**
 * Board layout (spec.md C-13): lay the grid, then choose the richest
 * detail-and-format layout that fits. Pure: text is measured through an
 * injected function, so the rules are tested without a browser.
 *
 * - **Detail rungs**: 1 status icon, status label and badge; 2 + relative
 *   time; 3 + short commit and phase; 4 + branch; 5 + commit message.
 * - **Formats**, widest-and-shortest first: *line* (everything on one
 *   line), *wrapped* (lead on line 1, the rest on line 2), *stacked* (one
 *   item per line). The lead (icon, status, badge) never breaks.
 * - **One size for every cell**: each layout is measured against the most
 *   demanding content on the board (cells, empty cells, stage headers and
 *   group labels).
 *
 * @module
 */
import type { Density } from '@/domain/config/devicePreferences';

export type Rung = 1 | 2 | 3 | 4 | 5;
const TOP_RUNG: Rung = 5;
export type CellFormat = 'line' | 'wrapped' | 'stacked';
const FORMATS: readonly CellFormat[] = ['line', 'wrapped', 'stacked'];

/** Readable text at 100% zoom (C-13). */
export const BASE_FONT_PX = 13;
/** Line height, in ems. */
export const LINE_HEIGHT = 1.35;
/** Space between items on a line, in ems. */
export const ITEM_GAP_EM = 0.45;
/** Extra width for the badge pill around its text, in ems. */
const BADGE_EXTRA_EM = 1.1;
/** Free text (names, branches, messages) is cut off at this length. */
const FREE_TEXT_CAP = 40;
/** Free text needs room for at least this many characters. */
const FREE_TEXT_MIN_CHARS = 8;
/** The row-name column takes at most this share of the grid area. */
const ROW_NAME_SHARE = 0.3;

/** Density changes only padding and gaps (C-13). Padding in ems; gap in px. */
const DENSITY: Record<Density, { padX: number; padY: number; gap: number }> = {
  compact: { padX: 0.35, padY: 0.12, gap: 2 },
  default: { padX: 0.6, padY: 0.35, gap: 3 },
  comfortable: { padX: 0.9, padY: 0.6, gap: 5 },
};

/** Cut free text at the cap, with an ellipsis. */
export const capText = (text: string): string =>
  text.length > FREE_TEXT_CAP ? `${text.slice(0, FREE_TEXT_CAP - 1)}…` : text;

/** What one box shows at a rung: the unbreakable lead, an optional badge
 * inside the lead, then fixed-form items, then free text (branch, commit
 * message). Free text is cut off at the column width when stacked, so it
 * never widens columns. */
export interface Content {
  /** Columns the box spans (group labels); its width is shared by them. */
  span?: number;
  lead: string;
  badge?: string;
  /** The badge follows the first fixed item (the commit) instead of the
   * lead (rung 3 and up, C-13). */
  badgeAfterFirst?: boolean;
  rest: readonly string[];
  free?: readonly string[];
}

export type Measure = (text: string, fontPx: number) => number;

/** Width and line count of `content` in `format`, excluding padding. */
export function contentBox(
  content: Content,
  format: CellFormat,
  fontPx: number,
  measure: Measure,
): { width: number; lines: number } {
  const gap = ITEM_GAP_EM * fontPx;
  const badge = content.badge
    ? gap + measure(content.badge, fontPx) + BADGE_EXTRA_EM * fontPx
    : 0;
  const afterFirst =
    content.badgeAfterFirst === true && content.rest.length > 0;
  const lead = measure(content.lead, fontPx) + (afterFirst ? 0 : badge);
  const fixed = content.rest.map(
    (t, i) => measure(t, fontPx) + (afterFirst && i === 0 ? badge : 0),
  );
  // Free text takes whatever width is left and is cut off with "…" in
  // every format, so it never forces wrapping or wider columns; it only
  // needs room for a few characters.
  const freeMin = measure('x'.repeat(FREE_TEXT_MIN_CHARS), fontPx);
  const free = (content.free ?? []).map((t) =>
    Math.min(measure(t, fontPx), freeMin),
  );
  const all = [...fixed, ...free];
  const restLine =
    all.reduce((sum, w) => sum + w, 0) + gap * Math.max(0, all.length - 1);
  if (all.length === 0) return { width: lead, lines: 1 };
  switch (format) {
    case 'line':
      return { width: lead + gap + restLine, lines: 1 };
    case 'wrapped':
      return { width: Math.max(lead, restLine), lines: 2 };
    case 'stacked':
      return {
        width: Math.max(lead, ...fixed, ...free),
        lines: 1 + all.length,
      };
  }
}

/** The worst case over every content: the widest box and the most lines. */
function worstBox(
  contents: readonly Content[],
  format: CellFormat,
  fontPx: number,
  measure: Measure,
): { width: number; lines: number } {
  let width = 0;
  let lines = 1;
  for (const c of contents) {
    const box = contentBox(c, format, fontPx, measure);
    width = Math.max(width, box.width / Math.max(1, c.span ?? 1));
    lines = Math.max(lines, box.lines);
  }
  return { width, lines };
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
    ROW_NAME_SHARE * input.width,
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

/** The layout for one rung: the least wrapped format that fits the column
 * width; if none fits, stacked, with columns widened to fit (scrolls right). */
function layoutAtRung(input: LayoutInput, rung: Rung, fontPx: number): Layout {
  const f = frame(input, fontPx);
  const contents = input.contents(rung);
  const boxes = FORMATS.map((format) => ({
    format,
    ...worstBox(contents, format, fontPx, input.measure),
  }));
  const fits = boxes.find((b) => b.width + 2 * f.padX <= f.colWidth);
  // Stacked is the narrowest; when nothing fits, columns widen to it.
  const chosen = fits ?? boxes[2];
  const colWidth = Math.max(f.colWidth, chosen.width + 2 * f.padX);
  const rowHeight = chosen.lines * LINE_HEIGHT * fontPx + 2 * f.padY;
  const total =
    (1 + input.labelRows) * (f.lineRowHeight + f.gap) +
    input.rows * (rowHeight + f.gap);
  return {
    rung,
    format: chosen.format,
    fontPx,
    rowNameWidth: f.rowNameWidth,
    colWidth,
    rowHeight,
    lineRowHeight: f.lineRowHeight,
    gap: f.gap,
    padX: f.padX,
    padY: f.padY,
    overflowX: !fits,
    overflowY: total > input.height + 0.5,
    boardHeight: total,
  };
}

/** Lay the grid, then choose (C-13): the richest rung that fits both
 * ways; else the board scrolls down as little as possible (the shortest
 * row height that fits the width), at the richest rung with that height;
 * columns overflow right only when rung 1, stacked, cannot fit. */
export function fitLayout(input: LayoutInput, fontPx: number): Layout {
  const all = ([5, 4, 3, 2, 1] as const).map((rung) =>
    layoutAtRung(input, rung, fontPx),
  );
  const fits = all.find((l) => !l.overflowX && !l.overflowY);
  if (fits) return fits;
  const across = all.filter((l) => !l.overflowX);
  const shortest = Math.min(...across.map((l) => l.rowHeight));
  return (
    across.find((l) => l.rowHeight <= shortest + 0.5) ??
    layoutAtRung(input, 1, fontPx)
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

export function zoomRange(input: LayoutInput): ZoomRange {
  const full = layoutAtRung(input, TOP_RUNG, BASE_FONT_PX);
  const top = Math.max(
    1,
    Math.ceil((full.boardHeight / Math.max(1, input.height)) * 10 - 1e-9) / 10,
  );
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
    return fitLayout({ ...input, height: input.height * z }, BASE_FONT_PX);
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
