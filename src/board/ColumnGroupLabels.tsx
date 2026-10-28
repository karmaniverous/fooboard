/**
 * The column-group label strip above the stage headers (spec.md C-14b),
 * shown when any column group has a label: each group's label over its
 * stages, inside the group's frame (drawn once, `ColumnFrames`), left-aligned and pinned just right of the row
 * names while any of the group is in view, with its settings gear (spec.md
 * §3.11; an unlabelled group has none).
 *
 * @module
 */
import type { ColumnGroup } from '@/domain/config/groups';
import type { GroupSegment } from '@/domain/groups/segments';
import { cn } from '@/lib/utils';

import {
  GROUP_LABEL,
  GROUP_LABEL_STYLE,
  PIN_LEFT,
  PIN_TOP_STRIP,
} from './gridStyles';
import { SettingsGear } from './SettingsGear';

export function ColumnGroupLabels({
  segments,
  columns,
  rowHeight,
  gap,
  labelLeft,
}: {
  segments: readonly GroupSegment<ColumnGroup>[];
  /** Each stage's grid column, by stage index (spec.md §3.7). */
  columns: readonly number[];
  rowHeight: number;
  /** The grid's gap: the pinned strip reaches across it to the stage
   * headers, so nothing shows between them while the board scrolls. */
  gap: number;
  /** Where a pinned label sticks: just right of the row names, in px. */
  labelLeft: number;
}): React.JSX.Element | null {
  if (!segments.some((g) => g.group?.label)) return null;
  // Down through the gap below (without growing the row), so the pinned
  // strip leaves no gap above the stage headers.
  const span = { height: rowHeight + gap, marginBottom: -gap };
  return (
    <div role="row" className="contents">
      <div
        className={cn(PIN_TOP_STRIP, PIN_LEFT, 'z-30')}
        style={{ ...span, gridColumn: '1' }}
      />
      {/* Each segment over its own stages (gutters lie between
          segments); labelled groups are column headers spanning their
          stages (C-14b). */}
      {segments.map((g) => (
        <div
          key={g.start}
          role={g.group?.label ? 'columnheader' : 'presentation'}
          aria-colspan={g.group?.label ? g.span : undefined}
          className={cn('flex items-end', PIN_TOP_STRIP, GROUP_LABEL)}
          style={{
            ...GROUP_LABEL_STYLE,
            ...span,
            gridColumn: `${String(columns[g.start])} / span ${String(g.span)}`,
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
