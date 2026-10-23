/**
 * Cell marks (spec.md §3.1, Decision 37): a provisional cell (shown from
 * its run alone until its jobs land) is drawn dashed, in its summary
 * status's look or, when its set has no status of that name, neutral; a
 * refreshing cell (cached data while newer data loads) carries a pulsing
 * corner dot. Marks are outlines and overlays, so they never change a
 * cell's size or reflow the board. Their words join the cell's accessible
 * name.
 *
 * @module
 */
import type { CSSProperties } from 'react';

import type { BoardCell } from '@/engine';
import { cn } from '@/lib/utils';

/** Words the marks add to a cell's accessible name. */
export const MARK_LABELS = {
  provisional: 'provisional',
  refreshing: 'refreshing',
} as const;

/** The dashed outline every provisional cell gets (no layout). */
const PROVISIONAL_CLASS =
  'outline-dashed outline-2 -outline-offset-4 outline-current';
/** A neutral provisional cell: no status colour. */
const NEUTRAL_CLASS =
  'bg-transparent text-foreground border border-dashed border-border';

/** The cell's look with its marks applied. */
export function markedLook(
  cell: Pick<BoardCell, 'provisional'>,
  look: { className?: string; style?: CSSProperties },
): { className?: string; style?: CSSProperties } {
  if (cell.provisional === 'neutral')
    return { className: cn(NEUTRAL_CLASS, PROVISIONAL_CLASS) };
  if (cell.provisional === 'status')
    return { ...look, className: cn(look.className, PROVISIONAL_CLASS) };
  return look;
}

/** The marks' words for the cell's accessible name. */
export const markWords = (
  cell: Pick<BoardCell, 'provisional' | 'refreshing'>,
): string[] => [
  ...(cell.provisional ? [MARK_LABELS.provisional] : []),
  ...(cell.refreshing ? [MARK_LABELS.refreshing] : []),
];
