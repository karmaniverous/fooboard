/**
 * The board grid (spec.md §4.4): stage headers across, row headers down,
 * one cell per row and stage, with row and column groups (C-14b). The
 * grid fills its container; every cell is the same size, so all cells show
 * the same detail level, chosen from the measured cell width (C-13). Hover
 * or focus shows a tooltip; a touch tap opens a detail sheet.
 *
 * @module
 */
import { Fragment, useState } from 'react';

import { WithTooltip } from '@/components/ui/tooltip';
import type { Dashboard } from '@/domain/config/dashboard';
import { groupSegments } from '@/domain/groups/segments';
import { type BoardModel, cellKey, CellKeySchema } from '@/engine';
import { cn } from '@/lib/utils';

import { Cell } from './Cell';
import { CellDetail, CellSheet, CellTooltip } from './CellDetail';
import { columnLines } from './columnFrame';
import { ColumnGroupLabels } from './ColumnGroupLabels';
import { BOUNDARY, GROUP_LABEL } from './gridStyles';
import { capText, type Layout, LINE_HEIGHT } from './layout';
import { ProblemMark } from './ProblemMark';
import { useProblemMarks } from './problemMarksContext';
import { rowLabel } from './rowLabel';
import { stageLabel } from './stageLabel';
import { type CellFilter, matchesFilter } from './summary';

export interface BoardGridProps {
  dashboard: Dashboard;
  model: BoardModel;
  /** The board layout (C-13): every cell's size, rung and format. */
  layout: Layout;
  now: number;
  /** Highlight only the cells in this summary category (spec.md C-14a). */
  filter?: CellFilter | null;
}

export function BoardGrid({
  dashboard,
  model,
  layout,
  now,
  filter = null,
}: BoardGridProps): React.JSX.Element {
  // Headers stay pinned whenever the grid scrolls (C-13): below the pinned
  // app header (its height, set by the header) and the column-group label
  // strip, when there is one (its height, `--strip-h`).
  const pinTop =
    'sticky top-[calc(var(--app-header-h,0px)+var(--strip-h,0px))] z-20 bg-background';
  const pinLeft = 'sticky left-0 z-20 bg-background';
  const { rows, stages } = dashboard;
  const marks = useProblemMarks();
  const rowSegments = groupSegments(
    rows.map((r) => r.id),
    dashboard.rowGroups,
  );
  const colSegments = groupSegments(
    stages.map((s) => s.id),
    dashboard.columnGroups,
  );
  const lines = columnLines(
    colSegments,
    stages.map((s) => s.id),
  );
  /** Stages of unlabelled column groups: the frame's top is on their
   * headers (a labelled group's is on its label). */
  const frameTop = new Set(
    colSegments.flatMap((g) =>
      g.group && !g.group.label
        ? stages.slice(g.start, g.start + g.span).map((st) => st.id)
        : [],
    ),
  );

  const [tip, setTip] = useState<{ key: string; rect: DOMRect } | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const names = (key: string) => {
    const [rowId, stageId] = CellKeySchema.parse(JSON.parse(key));
    return {
      rowName: rows.find((r) => r.id === rowId)?.displayName ?? rowId,
      stageName: stages.find((s) => s.id === stageId)?.name ?? stageId,
    };
  };
  const detail = (key: string, interactive: boolean) => {
    const cell = model.cells[key];
    return cell ? (
      <CellDetail
        cell={cell}
        interactive={interactive}
        problems={marks.cells.get(key)}
        {...names(key)}
      />
    ) : null;
  };

  // Exact widths: columns never stretch to their content (C-13).
  const columns = `${String(layout.rowNameWidth)}px repeat(${String(stages.length)}, ${String(layout.colWidth)}px)`;
  const lineRow = { height: layout.lineRowHeight };
  const cellRow = { height: layout.rowHeight };

  return (
    <>
      <div
        role="grid"
        aria-label={dashboard.name}
        data-rung={layout.rung}
        data-format={layout.format}
        aria-rowcount={rows.length + 1}
        aria-colcount={stages.length + 1}
        className="grid w-max"
        style={
          {
            gridTemplateColumns: columns,
            gap: layout.gap,
            fontSize: `${String(layout.fontPx)}px`,
            lineHeight: LINE_HEIGHT,
            '--cell-pad-x': `${String(layout.padX)}px`,
            '--cell-pad-y': `${String(layout.padY)}px`,
            // The label strip and the gap below it (C-14b).
            '--strip-h': colSegments.some((g) => g.group?.label)
              ? `${String(layout.lineRowHeight + layout.gap)}px`
              : '0px',
          } as React.CSSProperties
        }
      >
        <ColumnGroupLabels
          segments={colSegments}
          rowHeight={layout.lineRowHeight}
          gap={layout.gap}
          pinLeft={pinLeft}
          labelLeft={layout.rowNameWidth + layout.gap}
        />
        <div role="row" className="contents">
          <div
            role="columnheader"
            className={cn(pinTop, pinLeft, 'z-30')}
            style={lineRow}
          />
          {stages.map((stage) => {
            return (
              <WithTooltip key={stage.id} label={stageLabel(stage)}>
                <div
                  role="columnheader"
                  // Focusable, so the keyboard can show its tooltip.
                  tabIndex={0}
                  className={cn(
                    'flex items-center justify-center truncate px-[var(--cell-pad-x)] text-center font-semibold',
                    pinTop,
                    lines.headerLeft.has(stage.id) && BOUNDARY.left,
                    lines.headerRight.has(stage.id) && BOUNDARY.right,
                    frameTop.has(stage.id) && BOUNDARY.top,
                  )}
                  style={lineRow}
                >
                  <span className="truncate">{capText(stage.name)}</span>
                  <ProblemMark problems={marks.stages.get(stage.id)} />
                </div>
              </WithTooltip>
            );
          })}
        </div>
        {rowSegments.map((segment, si) => {
          const label = segment.group?.label;
          const segmentRows = rows.slice(
            segment.start,
            segment.start + segment.span,
          );
          // The boundary line sits on the label row when there is one,
          // else on the segment's first row (C-14b).
          const lineOnRow = si > 0 && !label;
          const body = (
            <>
              {label && (
                <div
                  className={cn(
                    'col-span-full flex items-end',
                    GROUP_LABEL,
                    si > 0 && BOUNDARY.top,
                  )}
                  style={lineRow}
                  role="presentation"
                >
                  {/* The label, not the full-width row, is pinned, so it stays
                      on screen when the board scrolls right (C-13). */}
                  <span className="sticky left-0 px-[var(--cell-pad-x)]">
                    {label}
                  </span>
                </div>
              )}
              {segmentRows.map((row, ri) => {
                const rowLine =
                  lineOnRow && ri === 0 ? BOUNDARY.top : undefined;
                return (
                  <div key={row.id} role="row" className="contents">
                    <WithTooltip label={rowLabel(row)}>
                      <div
                        role="rowheader"
                        tabIndex={0}
                        className={cn(
                          'flex items-center px-[var(--cell-pad-x)] font-medium',
                          pinLeft,
                          rowLine,
                        )}
                        style={cellRow}
                      >
                        <span className="truncate">{row.displayName}</span>
                        <ProblemMark problems={marks.rows.get(row.id)} />
                      </div>
                    </WithTooltip>
                    {stages.map((stage) => {
                      const key = cellKey(row.id, stage.id);
                      return (
                        <div
                          key={key}
                          role="gridcell"
                          className={cn(
                            'min-w-0 transition-opacity',
                            filter &&
                              !matchesFilter(model.cells[key], filter) &&
                              'opacity-25',
                            rowLine,
                            lines.bodyLeft.has(stage.id) && BOUNDARY.left,
                            lines.bodyRight.has(stage.id) && BOUNDARY.right,
                          )}
                          style={cellRow}
                        >
                          <Cell
                            cell={model.cells[key]}
                            rung={layout.rung}
                            lineOf={layout.lineOf}
                            now={now}
                            onInspect={(el) => {
                              setTip(
                                el
                                  ? { key, rect: el.getBoundingClientRect() }
                                  : null,
                              );
                            }}
                            onOpenSheet={() => {
                              setSheet(key);
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </>
          );
          // A row group is a labelled rowgroup in the grid (C-14b).
          return segment.group ? (
            <div
              key={segment.group.id}
              role="rowgroup"
              aria-label={label}
              className="contents"
            >
              {body}
            </div>
          ) : (
            <Fragment key={`ungrouped-${String(segment.start)}`}>
              {body}
            </Fragment>
          );
        })}
      </div>

      {tip && !sheet && (
        <CellTooltip rect={tip.rect}>{detail(tip.key, false)}</CellTooltip>
      )}
      {sheet && (
        <CellSheet
          onClose={() => {
            setSheet(null);
          }}
        >
          {detail(sheet, true)}
        </CellSheet>
      )}
    </>
  );
}
