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

import {
  type CellFormat,
  type Content,
  type LineMap,
  type Measure,
  minWidth,
  packBoard,
} from './packing';

export type Rung = 0 | 1 | 2 | 3 | 4 | 5;
export const TOP_RUNG: Rung = 5;

/** The lowest rung that shows each part of a cell (C-13): the status
 * name, time, commit (the badge follows it from there), branch or an
 * empty cell's reason, and the commit message. Cells and the layout that
 * measures them both read these, so they agree. */
export const RUNG_SHOWS = {
  name: 1,
  time: 2,
  commit: 3,
  branch: 4,
  message: 5,
} as const satisfies Record<string, Rung>;
const RUNGS_DOWN: readonly Rung[] = [5, 4, 3, 2, 1, 0];

/** Sub-pixel slack when comparing measured sizes, so rounding never flips
 * a fit. */
const PX_SLACK = 0.5;

/** Readable text at 100% zoom (C-13). */
export const BASE_FONT_PX = 13;
/** Line height, in ems. */
export const LINE_HEIGHT = 1.35;
/** Free text (names, branches, messages) is cut off at this length. */
const FREE_TEXT_CAP = 40;
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
export function layoutAtRung(
  input: LayoutInput,
  rung: Rung,
  fontPx: number,
): Layout {
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
    overflowY: total > input.height + PX_SLACK,
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
    across.find((l) => l.rowHeight <= shortest + PX_SLACK) ??
    layoutAtRung(input, 0, fontPx)
  );
}
