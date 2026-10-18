/**
 * The board's summary chips and the filters they toggle (spec.md C-14a,
 * A§4.3.6): one per summary status the board's cells show (in their set's
 * order, Unknown last), then *behind* and *diverged*. Pure.
 *
 * @module
 */
import { omit } from 'radash';

import type { BoardCell, BoardModel } from '@/engine';

/** A summary status id, or a staleness badge kind. */
export type CellFilter = string;

const BADGES = ['behind', 'diverged'] as const;

/** One chip: a summary status (with its colour) or a badge kind. */
export interface SummaryChip {
  id: CellFilter;
  name: string;
  /** The summary status's colour; badges are styled by kind. */
  color?: string;
  count: number;
}

/** Does `cell` belong to `filter`? Behind and diverged are separate. */
export function matchesFilter(
  cell: BoardCell | undefined,
  filter: CellFilter,
): boolean {
  if (!cell) return false;
  if (filter === 'behind' || filter === 'diverged')
    return cell.badge?.kind === filter;
  return (
    cell.derivation.kind === 'ok' &&
    cell.derivation.status.summary.id === filter
  );
}

/** The chips for `model`, with their counts. */
export function summarize(model: BoardModel): SummaryChip[] {
  const cells = Object.values(model.cells);
  const statuses = new Map<string, SummaryChip & { rank: number }>();
  for (const cell of cells) {
    const derivation = cell?.derivation;
    if (derivation?.kind !== 'ok') continue;
    const { id, name, color } = derivation.status.summary;
    const { rank } = derivation.status;
    const chip = statuses.get(id) ?? { id, name, color, count: 0, rank };
    chip.count += 1;
    statuses.set(id, chip);
  }
  const chips = [...statuses.values()]
    .sort((a, b) => a.rank - b.rank)
    .map((chip) => omit(chip, ['rank']));
  return [
    ...chips,
    ...BADGES.map((id) => ({
      id,
      name: id,
      count: cells.filter((c) => matchesFilter(c, id)).length,
    })),
  ];
}
