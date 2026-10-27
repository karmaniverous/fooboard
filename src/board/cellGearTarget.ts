/**
 * The grid cells the board's one cell gear can sit on (spec.md §3.11,
 * `CellGearLayer`): a grid cell with a cell is marked with its row and
 * stage, and an event's target is mapped back to the marked cell it is in.
 *
 * @module
 */
import { cellKey } from '@/engine';

import type { BoardPlace } from './settingsGearWords';

/** A grid cell the gear can sit on. */
export interface GearTarget {
  rowId: string;
  stageId: string;
  el: HTMLElement;
}

/** The attributes that mark a grid cell the gear can sit on. */
export const gearTargetProps = (
  rowId: string,
  stageId: string,
): Record<'data-gear-row' | 'data-gear-stage', string> => ({
  'data-gear-row': rowId,
  'data-gear-stage': stageId,
});

/** The attribute that marks the cell gear with the key of the grid cell
 * it sits on, so the cell's tooltip knows the gear is its own
 * (`withinCell`). */
export const gearOwnerProps = (
  target: Pick<GearTarget, 'rowId' | 'stageId'>,
): Record<'data-gear-of', string> => ({
  'data-gear-of': gearTargetKey(target),
});

/** The key of the grid cell whose gear an element is in, if any. */
export const gearOwnerOf = (node: Element): string | undefined =>
  node.closest<HTMLElement>('[data-gear-of]')?.dataset.gearOf;

/** The key of a grid cell the gear can sit on. */
export function gearTargetKey({
  rowId,
  stageId,
}: Pick<GearTarget, 'rowId' | 'stageId'>): string {
  return cellKey(rowId, stageId);
}

/** The settings place of a grid cell the gear can sit on. */
export const gearPlace = ({ rowId, stageId }: GearTarget): BoardPlace => ({
  level: 'cell',
  rowId,
  stageId,
});

/** The marked grid cell a node is in, if any. */
export const gearTargetOf = (node: EventTarget | null): GearTarget | null => {
  const el =
    node instanceof Element
      ? node.closest<HTMLElement>('[data-gear-row]')
      : null;
  const rowId = el?.dataset.gearRow;
  const stageId = el?.dataset.gearStage;
  return el && rowId !== undefined && stageId !== undefined
    ? { rowId, stageId, el }
    : null;
};
