/**
 * The column-group label strip above the stage headers (spec.md C-14b),
 * shown when any column group has a label: each group framed along the top
 * and both sides, its label left-aligned and pinned just right of the row
 * names while any of the group is in view.
 *
 * @module
 */
import type { ColumnGroup } from '@/domain/config/groups';
import type { GroupSegment } from '@/domain/groups/segments';
import { cn } from '@/lib/utils';

import { BOUNDARY, GROUP_LABEL } from './gridStyles';

export function ColumnGroupLabels({
  segments,
  rowHeight,
  pinLeft,
  labelLeft,
}: {
  segments: readonly GroupSegment<ColumnGroup>[];
  rowHeight: number;
  /** The pinned row-name column's classes (its corner cell). */
  pinLeft: string;
  /** Where a pinned label sticks: just right of the row names, in px. */
  labelLeft: number;
}): React.JSX.Element | null {
  if (!segments.some((g) => g.group?.label)) return null;
  return (
    <div role="row" className="contents">
      <div className={pinLeft} style={{ height: rowHeight }} />
      {/* Segments cover every column, so headers never auto-place
          into the strip's gaps; labelled groups are column headers
          spanning their stages (C-14b). */}
      {segments.map((g) => (
        <div
          key={g.start}
          role={g.group?.label ? 'columnheader' : 'presentation'}
          aria-colspan={g.group?.label ? g.span : undefined}
          className={cn(
            'flex items-end',
            GROUP_LABEL,
            // The frame's top and sides (C-14b).
            g.group && [BOUNDARY.top, BOUNDARY.left, BOUNDARY.right],
          )}
          style={{
            height: rowHeight,
            gridColumn: `${String(g.start + 2)} / span ${String(g.span)}`,
          }}
        >
          {/* Left-aligned, and pinned just right of the row names
              while any of the group is in view (C-14b). */}
          <span
            className="sticky truncate px-[var(--cell-pad-x)]"
            style={{ left: labelLeft }}
          >
            {g.group?.label}
          </span>
        </div>
      ))}
    </div>
  );
}
