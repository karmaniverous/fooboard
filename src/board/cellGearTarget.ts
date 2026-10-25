/**
 * The grid cells the board's one cell gear can sit on (spec.md §3.11,
 * `CellGearLayer`): a grid cell with a cell is marked with its row and
 * stage, and an event's target is mapped back to the marked cell it is in.
 *
 * @module
 */

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
