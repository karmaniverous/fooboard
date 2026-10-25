/**
 * One grid cell of the board (spec.md C-13, §3.11 *The cell's gear*): the
 * cell itself, and its settings gear laid over its top-right corner as a
 * sibling of the cell's link or button, never inside it. The gear is out
 * of the Tab order, so the cell stays one Tab stop; from the keyboard,
 * `,` (`CELL_SETTINGS_KEY`) on the focused cell opens the cell's popup,
 * anchored to its gear, and focus returns to the cell when it closes.
 *
 * @module
 */
import { useId, useState } from 'react';

import type { BoardCell } from '@/engine';
import { cn } from '@/lib/utils';

import { Cell, type CellProps } from './Cell';
import { CELL_SETTINGS_KEY } from './cellView';
import { SettingsGear } from './SettingsGear';
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
  const gearId = useId();
  // While the gear can be seen: the pointer is over the cell or focus is
  // in it (its icon is drawn only then; see `SettingsGear`).
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const place = { level: 'cell', rowId, stageId } as const;
  return (
    <div
      role="gridcell"
      className={cn('group relative min-w-0', className)}
      style={style}
      onMouseEnter={() => {
        setHovered(true);
      }}
      onMouseLeave={() => {
        setHovered(false);
      }}
      onFocus={() => {
        setFocused(true);
      }}
      onBlur={() => {
        setFocused(false);
      }}
      onKeyDown={(e) => {
        if (
          !popup ||
          e.key !== CELL_SETTINGS_KEY.key ||
          e.altKey ||
          e.ctrlKey ||
          e.metaKey ||
          !(e.target instanceof HTMLElement) ||
          e.target.id === gearId
        )
          return;
        popup.open({ place, gearId, returnFocus: e.target });
      }}
    >
      <Cell cell={cell} settingsKey={popup !== null} {...cellProps} />
      {cell && (
        <SettingsGear
          place={place}
          spot="corner"
          id={gearId}
          icon={hovered || focused}
        />
      )}
    </div>
  );
}
