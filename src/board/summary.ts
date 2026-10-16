/**
 * Summary header counts (spec.md C-14a): failing, running and behind
 * cells, each usable as a filter that highlights the matching cells. Pure.
 *
 * @module
 */
import type { BoardCell, BoardModel } from '@/engine';

/** A summary category, and the filter it toggles. */
export type CellFilter = 'failing' | 'running' | 'behind';

export const FILTERS: readonly CellFilter[] = ['failing', 'running', 'behind'];

/** Does `cell` belong to `filter`? Behind includes diverged. */
export function matchesFilter(
  cell: BoardCell | undefined,
  filter: CellFilter,
): boolean {
  if (!cell) return false;
  const { derivation } = cell;
  switch (filter) {
    case 'failing':
      return derivation.kind === 'ok' && derivation.status === 'failure';
    case 'running':
      return cell.active;
    case 'behind':
      return cell.badge !== undefined;
  }
}

/** Cell counts per category. */
export function summarize(model: BoardModel): Record<CellFilter, number> {
  const cells = Object.values(model.cells);
  return {
    failing: cells.filter((c) => matchesFilter(c, 'failing')).length,
    running: cells.filter((c) => matchesFilter(c, 'running')).length,
    behind: cells.filter((c) => matchesFilter(c, 'behind')).length,
  };
}
