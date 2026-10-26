/**
 * The board's body (spec.md C-13, C-14b, §3.7): each row segment, a
 * labelled `rowgroup` for a group: when it isn't the first, its label row
 * carries its boundary line (or, with no label, a gutter of its own does);
 * then its rows: a pinned row header and one cell per stage, each in its
 * own grid column (gutters lie between column groups). No cell carries a
 * boundary line.
 *
 * @module
 */
import { Fragment } from 'react';

import type { Dashboard } from '@/domain/config/dashboard';
import type { RowGroup } from '@/domain/config/groups';
import type { GroupSegment } from '@/domain/groups/segments';
import { type BoardModel, cellKey } from '@/engine';

import { GridCell } from './GridCell';
import { RowGutter } from './GroupFrames';
import { rowGroupLabelRoom, rowLineInLabel } from './groupGutters';
import type { Layout } from './layout';
import { RowGroupLabel, RowHeader } from './RowHeaders';
import { type CellFilter, matchesFilter } from './summary';

export function BoardRows({
  dashboard,
  segments,
  model,
  layout,
  now,
  filter,
  cellStyles,
  onInspect,
  onOpenSheet,
}: {
  dashboard: Pick<Dashboard, 'rows' | 'stages'>;
  segments: readonly GroupSegment<RowGroup>[];
  model: BoardModel;
  layout: Layout;
  now: number;
  filter: CellFilter | null;
  /** Each stage's cell style (its row height and grid column), by stage
   * index, shared by every row. */
  cellStyles: readonly React.CSSProperties[];
  onInspect: (key: string, el: HTMLElement | null) => void;
  onOpenSheet: (key: string, rowId: string, stageId: string) => void;
}): React.JSX.Element {
  const { rows, stages } = dashboard;
  const headerStyle = { height: layout.rowHeight, gridColumn: '1' };
  const lineRow = { height: layout.lineRowHeight };
  const lineTop = rowLineInLabel(layout.padY, layout.gap);
  return (
    <>
      {segments.map((segment, si) => {
        const label = segment.group?.label;
        const body = (
          <>
            {label && segment.group && (
              <RowGroupLabel
                group={segment.group}
                label={label}
                columns={stages.length + 1}
                lineTop={si > 0 ? lineTop : undefined}
                cutAt={layout.phone ? rowGroupLabelRoom(layout) : undefined}
                style={lineRow}
              />
            )}
            {rows
              .slice(segment.start, segment.start + segment.span)
              .map((row) => (
                <div key={row.id} role="row" className="contents">
                  <RowHeader row={row} style={headerStyle} />
                  {stages.map((stage, i) => {
                    const key = cellKey(row.id, stage.id);
                    return (
                      <GridCell
                        key={key}
                        rowId={row.id}
                        stageId={stage.id}
                        className={
                          filter && !matchesFilter(model.cells[key], filter)
                            ? 'opacity-25 transition-opacity'
                            : 'transition-opacity'
                        }
                        style={cellStyles[i]}
                        cell={model.cells[key]}
                        rung={layout.rung}
                        lineOf={layout.lineOf}
                        now={now}
                        onInspect={(el) => {
                          onInspect(key, el);
                        }}
                        onOpenSheet={() => {
                          onOpenSheet(key, row.id, stage.id);
                        }}
                      />
                    );
                  })}
                </div>
              ))}
          </>
        );
        // The gutter before an unlabelled segment, not the first, holds
        // its boundary's one line (spec.md §3.7).
        const boundary = si > 0 && !label && (
          <RowGutter gutter={layout.gutter} />
        );
        // A row group is a labelled rowgroup in the grid (C-14b).
        return segment.group ? (
          <Fragment key={segment.group.id}>
            {boundary}
            <div role="rowgroup" aria-label={label} className="contents">
              {body}
            </div>
          </Fragment>
        ) : (
          <Fragment key={`ungrouped-${String(segment.start)}`}>
            {boundary}
            {body}
          </Fragment>
        );
      })}
    </>
  );
}
