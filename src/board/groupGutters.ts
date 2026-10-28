/**
 * Where the board's group gutters go, and the grid tracks around them
 * (spec.md §3.7, Decision 13). A group boundary is no longer a border on
 * cells: it is a gutter, a spacer track of its own in the grid, and the
 * lines are drawn once in it.
 *
 * - **Column gutters**: one before every column segment after the first,
 *   and before a column group that starts the board (between it and the
 *   row names), plus one after a column group that ends the board, so
 *   every column group has a gutter on both sides for its frame's lines.
 *   Adjacent groups share the gutter between them.
 * - **Row gutters**: one before every row segment after the first that
 *   has no label row, holding the boundary's one line across the board.
 *   A labelled segment's label row is its boundary's gutter: the line runs
 *   across the band above the label (`rowLineInLabel`), so the demo board
 *   keeps its 21 one-line rows at `DEMO_VIEWPORT` (Decision 61).
 *
 * Pure, so the rules are tested without rendering.
 *
 * @module
 */
import type { ColumnGroup, RowGroup } from '@/domain/config/groups';
import { type GroupSegment, groupSegments } from '@/domain/groups/segments';

/** A gutter's spacer track, in ems of the board's text, so gutters scale
 * with zoom as the padding and the gears do (spec.md §3.7). The grid's gap
 * sits on both sides of it, so the line in its middle never touches a
 * card. 0.4 em (5.2 px at 100%) makes a boundary 11.2 px between cards
 * against the 3 px gap, and keeps the demo's 21 one-line rows within
 * `DEMO_VIEWPORT` (Decision 61). */
export const GROUP_GUTTER_EM = 0.4;
/** The width of a frame's or boundary's line, in px. */
export const FRAME_LINE_PX = 2;

/** The spacer track at a text size: never narrower than its line. */
export const gutterPx = (fontPx: number): number =>
  Math.max(FRAME_LINE_PX, GROUP_GUTTER_EM * fontPx);

/** One column group's frame: the grid columns it spans, from the gutter
 * on its left to the gutter on its right (1-based grid lines, end
 * exclusive). */
export interface ColumnFrame<G> {
  group: G;
  from: number;
  to: number;
}

/** The grid's column tracks: the row names, the stages and the gutters. */
export interface ColumnTracks<G> {
  /** Each stage's grid column (1-based), by stage index. */
  stageColumn: readonly number[];
  /** Grid columns (1-based) that are gutters. */
  gutters: readonly number[];
  frames: readonly ColumnFrame<G>[];
}

/** Lay the stages and gutters along the grid; column 1 is the row names. */
export function columnTracks<G>(
  segments: readonly GroupSegment<G>[],
): ColumnTracks<G> {
  const stageColumn: number[] = [];
  const gutters: number[] = [];
  const frames: ColumnFrame<G>[] = [];
  let column = 2;
  const gutter = () => {
    gutters.push(column);
    column += 1;
  };
  segments.forEach((s, i) => {
    if (i > 0 || s.group) gutter();
    // The gutter just placed is this segment's left side.
    const from = column - 1;
    for (let k = 0; k < s.span; k++) stageColumn[s.start + k] = column++;
    if (!s.group) return;
    // Its right side: the next segment's gutter (at `column`), or one of
    // its own at the end of the board.
    const right = column;
    if (i === segments.length - 1) gutter();
    frames.push({ group: s.group, from, to: right + 1 });
  });
  return { stageColumn, gutters, frames };
}

/** The kinds of the grid's row tracks: one-line rows (the label strip,
 * the stage headers and row-group labels), cell rows and gutters. */
export type RowTrack = 'line' | 'cell' | 'gutter';

/** The grid's rows, top to bottom: the label strip when there is one, the
 * stage headers, then each row segment: its label row when it has a
 * label, else a gutter when it isn't the first; then its rows. */
export function rowTracks(
  segments: readonly GroupSegment<{ id: string; label?: string }>[],
  strip: boolean,
): RowTrack[] {
  const tracks: RowTrack[] = strip ? ['line', 'line'] : ['line'];
  segments.forEach((s, i) => {
    if (s.group?.label) tracks.push('line');
    else if (i > 0) tracks.push('gutter');
    for (let k = 0; k < s.span; k++) tracks.push('cell');
  });
  return tracks;
}

/** A grid template from track sizes in px. */
export const trackTemplate = (sizes: readonly number[]): string =>
  sizes.map((s) => `${String(s)}px`).join(' ');

/** A board's groups as the grid and the layout both see them. */
export interface BoardGroups {
  rowSegments: GroupSegment<RowGroup>[];
  columnSegments: GroupSegment<ColumnGroup>[];
  /** Some column group has a label, so the board has a label strip. */
  strip: boolean;
  /** One-line rows besides the stage headers: the strip and the labelled
   * row groups' label rows. */
  labelRows: number;
  columnGutters: number;
  rowGutters: number;
}

/** Segment a board's rows and stages by group, and count what the layout
 * adds for them (label rows and gutters). */
export function boardGroups(dashboard: {
  rows: readonly { id: string }[];
  stages: readonly { id: string }[];
  rowGroups: readonly RowGroup[];
  columnGroups: readonly ColumnGroup[];
}): BoardGroups {
  const rowSegments = groupSegments(
    dashboard.rows.map((r) => r.id),
    dashboard.rowGroups,
  );
  const columnSegments = groupSegments(
    dashboard.stages.map((s) => s.id),
    dashboard.columnGroups,
  );
  const strip = columnSegments.some((g) => g.group?.label);
  return {
    rowSegments,
    columnSegments,
    strip,
    labelRows:
      rowSegments.filter((s) => s.group?.label).length + (strip ? 1 : 0),
    columnGutters: columnTracks(columnSegments).gutters.length,
    rowGutters: rowSegments.filter((s, i) => i > 0 && !s.group?.label).length,
  };
}

/** Where a boundary line runs inside a label row, from its top, in px:
 * centred in the band between the cards above (past the grid's gap) and
 * the label's text, which sits at the bottom of the row (spec.md §3.7). */
export const rowLineInLabel = (padY: number, gap: number): number =>
  (2 * padY - gap - FRAME_LINE_PX) / 2;

/** The widest a row-group label may run on a phone, in px from where its
 * text starts (past the row-name column's padding): up to the gutter
 * after the row-name column, a line's width short of a frame's line
 * centred in it, so a label cut there ends before that line and before
 * every frame further right (Decision 65). A label that fits stays
 * whole. */
export const rowGroupLabelRoom = (l: {
  rowNameWidth: number;
  padX: number;
  gap: number;
  gutter: number;
}): number =>
  l.rowNameWidth -
  l.padX +
  l.gap +
  (l.gutter - FRAME_LINE_PX) / 2 -
  FRAME_LINE_PX;
