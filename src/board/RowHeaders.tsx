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

import { GROUP_LABEL, GROUP_LABEL_STYLE, PIN_LEFT } from './gridStyles';
import { PinnedCover, RowLine } from './GroupFrames';
import { ProblemMark } from './ProblemMark';
import { useProblemMarks } from './problemMarksContext';
import { rowLabel } from './rowLabel';
import { SettingsGear } from './SettingsGear';

/** A labelled row group's label, across the grid above its rows: a row
 * of its own whose one header spans every column, so the label and its
 * gear sit in the grid's rows like everything else in it. Below another
 * segment, the row is the boundary's gutter, and the boundary's line runs
 * across it above the label, so the label and its gear sit inside the
 * group (spec.md §3.7). */
export function RowGroupLabel({
  group,
  label,
  columns,
  lineTop,
  style,
}: {
  group: RowGroup;
  label: string;
  /** The grid's columns (the row names' and the stages'), all spanned. */
  columns: number;
  /** Where the boundary line runs, from the row's top (px): none for the
   * board's first segment. */
  lineTop?: number;
  style: React.CSSProperties;
}): React.JSX.Element {
  return (
    <div role="row" className="contents">
      <div
        role="rowheader"
        aria-colspan={columns}
        className={cn('relative col-span-full flex items-end', GROUP_LABEL)}
        style={{ ...GROUP_LABEL_STYLE, ...style }}
      >
        {lineTop !== undefined && (
          <RowLine top={lineTop} data-boundary="row" className="inset-x-0" />
        )}
        {/* The label, not the full-width row, is pinned, so it stays on
            screen when the board scrolls right (C-13), on the pinned
            cover that hides the column frames passing under the row
            names; the label sits at the bottom, below the line. */}
        <PinnedCover lineTop={lineTop} className="px-[var(--cell-pad-x)]">
          <span className="flex items-center">
            {label}
            <SettingsGear
              place={{ level: 'rowGroup', groupId: group.id }}
              spot="header"
            />
          </span>
        </PinnedCover>
      </div>
    </div>
  );
}

/** A row's pinned header. */
export function RowHeader({
  row,
  style,
}: {
  row: Row;
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
          PIN_LEFT,
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
