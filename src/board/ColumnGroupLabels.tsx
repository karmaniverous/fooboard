/**
 * The column-group label strip above the stage headers (spec.md C-14b),
 * shown when any column group has a label: each group framed along the top
 * and both sides, its label left-aligned and pinned just right of the row
 * names while any of the group is in view, with its settings gear (spec.md
 * §3.11; an unlabelled group has none).
 *
 * @module
 */
import type { ColumnGroup } from '@/domain/config/groups';
import type { GroupSegment } from '@/domain/groups/segments';
import { cn } from '@/lib/utils';

import { BOUNDARY, GROUP_LABEL } from './gridStyles';
import { SettingsGear } from './SettingsGear';

/** Pinned to the top while the board scrolls down, below the app header. */
const PIN_TOP = 'sticky top-[var(--app-header-h,0px)] z-20 bg-background';

export function ColumnGroupLabels({
  segments,
  rowHeight,
  gap,
  pinLeft,
  labelLeft,
}: {
  segments: readonly GroupSegment<ColumnGroup>[];
  rowHeight: number;
  /** The grid's gap: the strip reaches across it to the stage headers,
   * so a group's frame has no break. */
  gap: number;
  /** The pinned row-name column's classes (its corner cell). */
  pinLeft: string;
  /** Where a pinned label sticks: just right of the row names, in px. */
  labelLeft: number;
}): React.JSX.Element | null {
  if (!segments.some((g) => g.group?.label)) return null;
  // Down through the gap below (without growing the row), so the frame's
  // sides meet the stage headers' and the pinned strip leaves no gap.
  const span = { height: rowHeight + gap, marginBottom: -gap };
  return (
    <div role="row" className="contents">
      <div className={cn(PIN_TOP, pinLeft, 'z-30')} style={span} />
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
            PIN_TOP,
            GROUP_LABEL,
            // The frame's top and sides (C-14b).
            g.group && [BOUNDARY.top, BOUNDARY.left, BOUNDARY.right],
          )}
          style={{
            ...span,
            gridColumn: `${String(g.start + 2)} / span ${String(g.span)}`,
          }}
        >
          {/* Left-aligned, and pinned just right of the row names
              while any of the group is in view (C-14b). */}
          <span
            className="sticky flex min-w-0 items-center px-[var(--cell-pad-x)]"
            style={{ left: labelLeft }}
          >
            <span className="truncate">{g.group?.label}</span>
            {g.group?.label && (
              <SettingsGear
                place={{ level: 'columnGroup', groupId: g.group.id }}
                spot="header"
              />
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
