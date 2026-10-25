/**
 * The board's row-axis headers (spec.md C-13, C-14b): a labelled row
 * group's label row, and each row's pinned header (its name cut to the
 * column and in full in its tooltip, its problem marker). Each carries its
 * settings gear (spec.md §3.11); clicking a header or label opens nothing.
 *
 * @module
 */
import { WithTooltip } from '@/components/ui/tooltip';
import type { RowGroup } from '@/domain/config/groups';
import type { Row } from '@/domain/config/row';
import { cn } from '@/lib/utils';

import { BOUNDARY, GROUP_LABEL } from './gridStyles';
import { ProblemMark } from './ProblemMark';
import { useProblemMarks } from './problemMarksContext';
import { rowLabel } from './rowLabel';
import { SettingsGear } from './SettingsGear';

/** A labelled row group's label, across the grid above its rows. */
export function RowGroupLabel({
  group,
  label,
  boundary,
  style,
}: {
  group: RowGroup;
  label: string;
  /** Draw the boundary line above it (not the first segment). */
  boundary: boolean;
  style: React.CSSProperties;
}): React.JSX.Element {
  return (
    <div
      className={cn(
        'col-span-full flex items-end',
        GROUP_LABEL,
        boundary && BOUNDARY.top,
      )}
      style={style}
      role="presentation"
    >
      {/* The label, not the full-width row, is pinned, so it stays on
          screen when the board scrolls right (C-13). */}
      <span className="sticky left-0 flex items-center px-[var(--cell-pad-x)]">
        {label}
        <SettingsGear
          place={{ level: 'rowGroup', groupId: group.id }}
          spot="header"
        />
      </span>
    </div>
  );
}

/** A row's pinned header. */
export function RowHeader({
  row,
  className,
  style,
}: {
  row: Row;
  /** Pinning and the boundary line. */
  className: string;
  style: React.CSSProperties;
}): React.JSX.Element {
  const marks = useProblemMarks();
  return (
    <WithTooltip label={rowLabel(row)}>
      <div
        role="rowheader"
        tabIndex={0}
        className={cn(
          'flex items-center px-[var(--cell-pad-x)] font-medium',
          className,
        )}
        style={style}
      >
        <span className="truncate">{row.displayName}</span>
        <ProblemMark problems={marks.rows.get(row.id)} />
        <SettingsGear place={{ level: 'row', rowId: row.id }} spot="header" />
      </div>
    </WithTooltip>
  );
}
