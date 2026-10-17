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
  lead: string;
  badge?: string;
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
  const lead =
    measure(content.lead, fontPx) +
    (content.badge
      ? gap + measure(content.badge, fontPx) + BADGE_EXTRA_EM * fontPx
      : 0);
  const fixed = content.rest.map((t) => measure(t, fontPx));
  const free = (content.free ?? []).map((t) => measure(t, fontPx));
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
      return { width: Math.max(lead, ...fixed), lines: 1 + all.length };
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
    width = Math.max(width, box.width);
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
    (input.width - rowNameWidth - d.gap * stages) / stages,
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

// --- Zoom (C-13): one scale, saved as a single number. -------------------
// [0.5, 1]: text scale (continuous). Above 1, each 0.25 is one step: first
// richer rungs at 13 px, then magnification in 25% steps to 300% text.

const MIN_ZOOM = 0.5;
const ZOOM_STEP = 0.25;
const MAX_MAGNIFY = 3;
const MAGNIFY_STEPS = Math.round((MAX_MAGNIFY - 1) / ZOOM_STEP);

/** Steps above 100% for a zoom value (gestures snap to whole steps). */
const zoomSteps = (zoom: number): number =>
  zoom <= 1 ? 0 : Math.round((zoom - 1) / ZOOM_STEP);

/** The highest zoom value for a board whose fitted rung is `fitted`. */
export const maxZoom = (fitted: Rung): number =>
  1 + ZOOM_STEP * (TOP_RUNG - fitted + MAGNIFY_STEPS);

export const clampZoom = (zoom: number, fitted: Rung): number =>
  Math.min(maxZoom(fitted), Math.max(MIN_ZOOM, zoom));

/** The layout at a zoom value. */
export function layoutAtZoom(input: LayoutInput, zoom: number): Layout {
  if (zoom <= 1) {
    return fitLayout(input, BASE_FONT_PX * Math.max(MIN_ZOOM, zoom));
  }
  const fitted = fitLayout(input, BASE_FONT_PX);
  const steps = zoomSteps(clampZoom(zoom, fitted.rung));
  const climb = TOP_RUNG - fitted.rung;
  if (steps <= climb) {
    return layoutAtRung(input, (fitted.rung + steps) as Rung, BASE_FONT_PX);
  }
  const magnify = Math.min(MAX_MAGNIFY, 1 + ZOOM_STEP * (steps - climb));
  return layoutAtRung(input, TOP_RUNG, BASE_FONT_PX * magnify);
}

/** One zoom step in or out. Below 100% steps are ×/÷ 1.25; above, whole
 * steps; 100% is always a stop. */
export function stepZoom(
  zoom: number,
  direction: 1 | -1,
  fitted: Rung,
): number {
  if (zoom < 1 || (zoom === 1 && direction < 0)) {
    const next = direction > 0 ? zoom * 1.25 : zoom / 1.25;
    return next > 0.97 ? 1 : clampZoom(next, fitted);
  }
  return clampZoom(1 + ZOOM_STEP * (zoomSteps(zoom) + direction), fitted);
}

/** Continuous wheel or pinch zoom; values above 1 snap when laid out. */
export const wheelZoom = (zoom: number, deltaY: number, fitted: Rung): number =>
  clampZoom(zoom * Math.exp(-deltaY / 300), fitted);

/** What the zoom control shows. */
export function zoomLabel(zoom: number, fitted: Rung): string {
  if (zoom <= 1)
    return `${String(Math.round(Math.max(MIN_ZOOM, zoom) * 100))}%`;
  const steps = zoomSteps(clampZoom(zoom, fitted));
  if (steps === 0) return '100%';
  const climb = TOP_RUNG - fitted;
  return steps <= climb
    ? `Detail +${String(steps)}`
    : `${String(Math.round((1 + ZOOM_STEP * (steps - climb)) * 100))}%`;
}
