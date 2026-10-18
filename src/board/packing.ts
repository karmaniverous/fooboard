/**
 * Packing a cell's content into lines (spec.md C-13): the lead (icon,
 * label, badge) has the first line; when everything fits on it, the board
 * is one line per cell. Otherwise the items fill the following lines left
 * to right, starting a new line only when the next will not fit, and one
 * arrangement (the most demanding content's breaks) applies to every cell.
 * Free text needs only a few characters and is cut off. Pure.
 *
 * @module
 */

/** The items a cell can show after its lead, in display order. */
export type ItemKey =
  'time' | 'commit' | 'phase' | 'branch' | 'message' | 'extra';

/** One line per cell, or items packed onto lines after the lead's. */
export type CellFormat = 'line' | 'packed';

/** Space between items on a line, in ems. */
export const ITEM_GAP_EM = 0.45;
/** Extra width for the badge around its text (padding and outline), in ems. */
const BADGE_EXTRA_EM = 1.1;
/** Free text needs room for at least this many characters. */
const FREE_TEXT_MIN_CHARS = 8;
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
export function packBoard(
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
    for (const { key } of c.items) {
      const line = own[key];
      if (line !== undefined) lineOf[key] ??= line;
    }
  }
  let lines = 1;
  for (const { c } of packs) {
    for (const i of c.items) lines = Math.max(lines, (lineOf[i.key] ?? 0) + 1);
  }
  return { format: 'packed', lines, lineOf };
}
