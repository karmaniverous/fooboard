/**
 * The board's summary chips and the filters they toggle (spec.md C-14a,
 * A§4.3.6): one per summary status the board's cells show (in their set's
 * order, Unknown last), then *behind* and *diverged*. Summary status ids
 * are unique only within a set, so a chip is a summary status's look (its
 * colour and name): sets that share one share a chip, and a set that
 * renames or recolours one gets its own. Badge chips have their own
 * namespace, so a status id can't collide with them. A provisional cell
 * (Decision 37) counts toward no chip and matches no filter until its jobs
 * land. Pure, apart from the filter hook.
 *
 * @module
 */
import { omit } from 'radash';
import { useState } from 'react';

import type { SummaryStatus } from '@/domain/config/statusSets';
import type { BoardCell, BoardModel } from '@/engine';

/** A chip's id: `status:<colour>:<name>` or `badge:<kind>`. */
export type CellFilter = string;

const BADGES = ['behind', 'diverged'] as const;
export type BadgeKind = (typeof BADGES)[number];

/** The filter for a summary status (its look; colours are fixed-width). */
const statusFilter = (s: Pick<SummaryStatus, 'color' | 'name'>): CellFilter =>
  `status:${s.color}:${s.name}`;
const badgeFilter = (kind: BadgeKind): CellFilter => `badge:${kind}`;

/** One chip: a summary status (with its colour) or a badge kind. */
export interface SummaryChip {
  id: CellFilter;
  name: string;
  /** The summary status's colour; badges are styled by kind. */
  color?: string;
  /** Set on badge chips. */
  badge?: BadgeKind;
  count: number;
}

/** Does `cell` belong to `filter`? Behind and diverged are separate. */
export function matchesFilter(
  cell: BoardCell | undefined,
  filter: CellFilter,
): boolean {
  if (!cell || cell.provisional) return false;
  const badge = BADGES.find((b) => badgeFilter(b) === filter);
  if (badge) return cell.badge?.kind === badge;
  return (
    cell.derivation.kind === 'ok' &&
    statusFilter(cell.derivation.status.summary) === filter
  );
}

/** The chips for `model`, with their counts. */
export function summarize(model: BoardModel): SummaryChip[] {
  const cells = Object.values(model.cells).filter((c) => !c?.provisional);
  const statuses = new Map<string, SummaryChip & { rank: number }>();
  for (const cell of cells) {
    const derivation = cell?.derivation;
    if (derivation?.kind !== 'ok') continue;
    const { summary, rank } = derivation.status;
    const id = statusFilter(summary);
    const chip = statuses.get(id) ?? {
      id,
      name: summary.name,
      color: summary.color,
      count: 0,
      rank,
    };
    chip.count += 1;
    statuses.set(id, chip);
  }
  const chips = [...statuses.values()]
    .sort((a, b) => a.rank - b.rank)
    .map((chip) => omit(chip, ['rank']));
  return [
    ...chips,
    ...BADGES.map((badge) => {
      const id = badgeFilter(badge);
      return {
        id,
        name: badge,
        badge,
        count: cells.filter((c) => matchesFilter(c, id)).length,
      };
    }),
  ];
}

/** The board's filter, cleared when its chip goes (its last cell changed
 * status), so the board never filters by a chip it no longer shows. */
export function useCellFilter(
  model: BoardModel,
): [CellFilter | null, (filter: CellFilter | null) => void] {
  const [filter, setFilter] = useState<CellFilter | null>(null);
  if (filter !== null && !summarize(model).some((c) => c.id === filter))
    setFilter(null);
  return [filter, setFilter];
}
