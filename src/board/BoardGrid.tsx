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
import { type BoardModel, cellKey } from '@/engine';
import { cn } from '@/lib/utils';

import { Cell } from './Cell';
import { CellDetail, CellSheet, CellTooltip } from './CellDetail';
import { capText, type Layout, LINE_HEIGHT } from './layout';
import { type CellFilter, matchesFilter } from './summary';

/** Group label text, over columns and above rows (C-14b). */
const GROUP_LABEL =
  'text-[0.85em] font-semibold uppercase tracking-wide text-muted-foreground';

/** The line drawn at every group boundary (C-14b). */
const BOUNDARY = {
  top: 'border-t-2 border-foreground/40',
  left: 'border-l-2 border-foreground/40',
} as const;

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
  // Headers stay pinned whenever the grid scrolls (C-13).
  // Below the pinned app header (its height, set by the header).
  const pinTop = 'sticky top-[var(--app-header-h,0px)] z-20 bg-background';
  const pinLeft = 'sticky left-0 z-20 bg-background';
  const { rows, stages, statusColors } = dashboard;
  const rowSegments = groupSegments(
    rows.map((r) => r.id),
    dashboard.rowGroups,
  );
  const colSegments = groupSegments(
    stages.map((s) => s.id),
    dashboard.columnGroups,
  );
  /** Stages that start a column segment after the first: boundary line. */
  const colBoundary = new Set(
    colSegments.slice(1).flatMap((g) => stages[g.start]?.id ?? []),
  );

  const [tip, setTip] = useState<{ key: string; rect: DOMRect } | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const names = (key: string) => {
    const [rowId, stageId] = JSON.parse(key) as [string, string];
    return {
      rowName: rows.find((r) => r.id === rowId)?.displayName ?? rowId,
      stageName: stages.find((s) => s.id === stageId)?.name ?? stageId,
    };
  };
  const detail = (key: string, interactive: boolean) => {
    const cell = model.cells[key];
    return cell ? (
      <CellDetail cell={cell} interactive={interactive} {...names(key)} />
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
          } as React.CSSProperties
        }
      >
        {colSegments.some((g) => g.group?.label) && (
          <div role="row" className="contents">
            <div className={pinLeft} style={lineRow} />
            {/* Segments cover every column, so headers never auto-place
                into the strip's gaps; labelled groups are column headers
                spanning their stages (C-14b). */}
            {colSegments.map((g, i) => (
              <div
                key={g.start}
                role={g.group?.label ? 'columnheader' : 'presentation'}
                aria-colspan={g.group?.label ? g.span : undefined}
                className={cn(
                  'flex items-end justify-center truncate px-[var(--cell-pad-x)]',
                  GROUP_LABEL,
                  i > 0 && BOUNDARY.left,
                )}
                style={{
                  ...lineRow,
                  gridColumn: `${String(g.start + 2)} / span ${String(g.span)}`,
                }}
              >
                {g.group?.label}
              </div>
            ))}
          </div>
        )}
        <div role="row" className="contents">
          <div
            role="columnheader"
            className={cn(pinTop, pinLeft, 'z-30')}
            style={lineRow}
          />
          {stages.map((stage) => {
            return (
              <WithTooltip
                key={stage.id}
                label={`${stage.name} (${stage.branchPattern})`}
              >
                <div
                  role="columnheader"
                  className={cn(
                    'flex items-center justify-center truncate px-[var(--cell-pad-x)] text-center font-semibold',
                    pinTop,
                    colBoundary.has(stage.id) && BOUNDARY.left,
                  )}
                  style={lineRow}
                >
                  <span className="truncate">{capText(stage.name)}</span>
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
                    <WithTooltip label={`${row.displayName} (${row.repo})`}>
                      <div
                        role="rowheader"
                        className={cn(
                          'flex items-center px-[var(--cell-pad-x)] font-medium',
                          pinLeft,
                          rowLine,
                        )}
                        style={cellRow}
                      >
                        <span className="truncate">{row.displayName}</span>
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
                            colBoundary.has(stage.id) && BOUNDARY.left,
                          )}
                          style={cellRow}
                        >
                          <Cell
                            cell={model.cells[key]}
                            rung={layout.rung}
                            lineOf={layout.lineOf}
                            colors={statusColors}
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
