/**
 * The board grid (spec.md §4.4): stage headers across, row headers down,
 * one cell per row and stage, with dividers and group labels (C-14b). The
 * grid fills its container; every cell is the same size, so all cells show
 * the same detail level, chosen from the measured cell width (C-13). Hover
 * or focus shows a tooltip; a touch tap opens a detail sheet.
 *
 * @module
 */
import { Fragment, useState } from 'react';

import type { Dashboard } from '@/domain/config/dashboard';
import type { Divider, DividerStyle } from '@/domain/config/dividers';
import { type BoardModel, cellKey } from '@/engine';
import { cn } from '@/lib/utils';

import { Cell } from './Cell';
import { CellDetail, CellSheet, CellTooltip } from './CellDetail';
import { columnGroups } from './columnGroups';
import { capText, type Layout, LINE_HEIGHT } from './layout';
import { type CellFilter, matchesFilter } from './summary';

/** Divider line per style, drawn on the top (rows) or left (stages). */
const DIVIDER: Record<DividerStyle, { top: string; left: string }> = {
  thin: { top: 'border-t border-border', left: 'border-l border-border' },
  thick: {
    top: 'border-t-2 border-foreground/40',
    left: 'border-l-2 border-foreground/40',
  },
  double: {
    top: 'border-t-4 border-double border-foreground/40',
    left: 'border-l-4 border-double border-foreground/40',
  },
  dashed: {
    top: 'border-t border-dashed border-foreground/40',
    left: 'border-l border-dashed border-foreground/40',
  },
  blank: { top: 'pt-2', left: 'pl-2' },
};

const byBefore = (dividers: readonly Divider[]) =>
  new Map(dividers.map((d) => [d.beforeId, d]));

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
  const pinTop = 'sticky top-0 z-20 bg-background';
  const pinLeft = 'sticky left-0 z-20 bg-background';
  const { rows, stages, statusColors } = dashboard;
  const rowDividers = byBefore(dashboard.rowDividers);
  const colDividers = byBefore(dashboard.columnDividers);
  const groups = columnGroups(stages, colDividers);

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

  const columns = `${String(layout.rowNameWidth)}px repeat(${String(stages.length)}, minmax(${String(layout.colWidth)}px, 1fr))`;
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
        className="grid w-full"
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
        {groups.some((g) => g.label) && (
          <div role="row" className="contents">
            <div className={pinLeft} style={lineRow} />
            {groups.map((g) => (
              <div
                key={g.start}
                className="flex items-end truncate px-[var(--cell-pad-x)] text-[0.85em] font-semibold uppercase tracking-wide text-muted-foreground"
                style={{
                  ...lineRow,
                  gridColumn: `${String(g.start + 2)} / span ${String(g.span)}`,
                }}
              >
                {g.label}
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
            const divider = colDividers.get(stage.id);
            return (
              <div
                key={stage.id}
                role="columnheader"
                className={cn(
                  'flex items-center truncate px-[var(--cell-pad-x)] font-semibold',
                  pinTop,
                  divider && DIVIDER[divider.style].left,
                )}
                style={lineRow}
                title={`${stage.name} (${stage.branchPattern})`}
              >
                <span className="truncate">{capText(stage.name)}</span>
              </div>
            );
          })}
        </div>
        {rows.map((row) => {
          const divider = rowDividers.get(row.id);
          // A labelled divider draws its line above the label, which then
          // heads the group; an unlabelled one sits on the row itself.
          const rowLine =
            divider && !divider.label ? DIVIDER[divider.style].top : undefined;
          return (
            <Fragment key={row.id}>
              {divider?.label && (
                <div
                  className={cn(
                    'sticky left-0 col-span-full flex items-end px-[var(--cell-pad-x)] text-[0.85em] font-semibold uppercase tracking-wide text-muted-foreground',
                    DIVIDER[divider.style].top,
                  )}
                  style={lineRow}
                  role="presentation"
                >
                  {divider.label}
                </div>
              )}
              <div role="row" className="contents">
                <div
                  role="rowheader"
                  className={cn(
                    'flex items-center px-[var(--cell-pad-x)] font-medium',
                    pinLeft,
                    rowLine,
                  )}
                  style={cellRow}
                  title={`${row.displayName} (${row.repo})`}
                >
                  <span className="truncate">{row.displayName}</span>
                </div>
                {stages.map((stage) => {
                  const key = cellKey(row.id, stage.id);
                  const colDivider = colDividers.get(stage.id);
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
                        colDivider && DIVIDER[colDivider.style].left,
                      )}
                      style={cellRow}
                    >
                      <Cell
                        cell={model.cells[key]}
                        rung={layout.rung}
                        format={layout.format}
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
