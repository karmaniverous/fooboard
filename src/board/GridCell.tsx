/**
 * One grid cell of the board (spec.md C-13, §3.11 *The cell's gear*): the
 * cell itself, marked as a place the board's one cell gear can sit
 * (`CellGearLayer`) once it has a cell. The cell holds no gear, handler or
 * state of its own for it, so moving the gear never re-renders a cell.
 *
 * @module
 */
import type { BoardCell } from '@/engine';
import { cn } from '@/lib/utils';

import { Cell, type CellProps } from './Cell';
import { gearTargetProps } from './cellGearTarget';
import { useSettingsPopup } from './settingsPopupContext';

export function GridCell({
  rowId,
  stageId,
  cell,
  className,
  style,
  ...cellProps
}: Omit<CellProps, 'cell' | 'settingsKey'> & {
  rowId: string;
  stageId: string;
  cell: BoardCell | undefined;
  /** The grid cell's own classes (lines, filter dimming). */
  className?: string;
  style: React.CSSProperties;
}): React.JSX.Element {
  const popup = useSettingsPopup();
  return (
    <div
      role="gridcell"
      className={cn('min-w-0', className)}
      style={style}
      {...(cell && popup && gearTargetProps(rowId, stageId))}
    >
      <Cell cell={cell} settingsKey={popup !== null} {...cellProps} />
    </div>
  );
}
