/**
 * The board grid (spec.md §4.4): stage headers across, row headers down,
 * one cell per row and stage, with dividers and group labels (C-14b). The
 * grid fills its container; every cell is the same size, so all cells show
 * the same detail level, chosen from the measured cell width (C-13). Hover
 * or focus shows a tooltip; a touch tap opens a detail sheet.
 *
 * @module
 */
import { Fragment, useEffect, useRef, useState } from 'react';

import type { Dashboard } from '@/domain/config/dashboard';
import type { Divider, DividerStyle } from '@/domain/config/dividers';
import { type BoardModel, cellKey } from '@/engine';
import { cn } from '@/lib/utils';

import { Cell } from './Cell';
import { CellDetail } from './CellDetail';
import { detailLevel } from './cellView';

const DIVIDER_ROW: Record<DividerStyle, string> = {
  thin: 'border-t border-border',
  thick: 'border-t-2 border-foreground/40',
  double: 'border-t-4 border-double border-foreground/40',
  dashed: 'border-t border-dashed border-foreground/40',
  blank: 'pt-2',
};
const DIVIDER_COL: Record<DividerStyle, string> = {
  thin: 'border-l border-border',
  thick: 'border-l-2 border-foreground/40',
  double: 'border-l-4 border-double border-foreground/40',
  dashed: 'border-l border-dashed border-foreground/40',
  blank: 'pl-2',
};

const byBefore = (dividers: readonly Divider[]) =>
  new Map(dividers.map((d) => [d.beforeId, d]));

/** Column group labels: each labelled divider heads the stages up to the
 * next divider. */
function columnGroups(
  stages: Dashboard['stages'],
  dividers: ReadonlyMap<string, Divider>,
): { label: string; start: number; span: number }[] {
  const groups: { label: string; start: number; span: number }[] = [];
  stages.forEach((stage, i) => {
    const divider = dividers.get(stage.id);
    if (divider) groups.push({ label: divider.label ?? '', start: i, span: 0 });
    const current = groups.at(-1);
    if (current) current.span += 1;
  });
  return groups.filter((g) => g.label);
}

export interface BoardGridProps {
  dashboard: Dashboard;
  model: BoardModel;
  rowHeight: 'compact' | 'full';
  now: number;
}

export function BoardGrid({
  dashboard,
  model,
  rowHeight,
  now,
}: BoardGridProps): React.JSX.Element {
  const { rows, stages, statusColors } = dashboard;
  const rowDividers = byBefore(dashboard.rowDividers);
  const colDividers = byBefore(dashboard.columnDividers);
  const groups = columnGroups(stages, colDividers);

  const probe = useRef<HTMLDivElement>(null);
  const [cellWidth, setCellWidth] = useState(0);
  useEffect(() => {
    const el = probe.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries.at(0);
      if (entry) setCellWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);
  const level = detailLevel(cellWidth, rowHeight);

  const [tip, setTip] = useState<{ key: string; rect: DOMRect } | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const names = (key: string) => {
    const [rowId, stageId] = JSON.parse(key) as [string, string];
    return {
      rowName: rows.find((r) => r.id === rowId)?.displayName ?? rowId,
      stageName: stages.find((s) => s.id === stageId)?.name ?? stageId,
    };
  };
  const detail = (key: string) => {
    const cell = model.cells[key];
    return cell ? <CellDetail cell={cell} {...names(key)} /> : null;
  };

  const columns = `minmax(6rem, max-content) repeat(${String(stages.length)}, minmax(0, 1fr))`;

  return (
    <>
      <div
        role="grid"
        aria-label={dashboard.name}
        aria-rowcount={rows.length + 1}
        aria-colcount={stages.length + 1}
        className="grid h-full gap-[3px] text-xs"
        style={{
          gridTemplateColumns: columns,
          gridAutoRows:
            rowHeight === 'full' ? 'minmax(2.6em, 1fr)' : 'minmax(1.6em, 1fr)',
        }}
      >
        {groups.length > 0 && (
          <div role="row" className="contents">
            <div />
            {groups.map((g) => (
              <div
                key={g.start}
                className="text-[0.85em] font-semibold uppercase tracking-wide text-muted-foreground"
                style={{
                  gridColumn: `${String(g.start + 2)} / span ${String(g.span)}`,
                }}
              >
                {g.label}
              </div>
            ))}
          </div>
        )}
        <div role="row" className="contents">
          <div role="columnheader" />
          {stages.map((stage, i) => {
            const divider = colDividers.get(stage.id);
            return (
              <div
                key={stage.id}
                ref={i === 0 ? probe : undefined}
                role="columnheader"
                className={cn(
                  'truncate px-1 font-semibold',
                  divider && DIVIDER_COL[divider.style],
                )}
                title={stage.branchPattern}
              >
                {stage.name}
              </div>
            );
          })}
        </div>
        {rows.map((row) => {
          const divider = rowDividers.get(row.id);
          return (
            <Fragment key={row.id}>
              {divider?.label && (
                <div
                  className="col-span-full pt-1 text-[0.85em] font-semibold uppercase tracking-wide text-muted-foreground"
                  role="presentation"
                >
                  {divider.label}
                </div>
              )}
              <div role="row" className="contents">
                <div
                  role="rowheader"
                  className={cn(
                    'flex items-center truncate px-1 font-medium',
                    divider && DIVIDER_ROW[divider.style],
                  )}
                  title={row.repo}
                >
                  {row.displayName}
                </div>
                {stages.map((stage) => {
                  const key = cellKey(row.id, stage.id);
                  const colDivider = colDividers.get(stage.id);
                  return (
                    <div
                      key={key}
                      role="gridcell"
                      className={cn(
                        'min-h-0 min-w-0',
                        divider && DIVIDER_ROW[divider.style],
                        colDivider && DIVIDER_COL[colDivider.style],
                      )}
                    >
                      <Cell
                        cell={model.cells[key]}
                        level={level}
                        rowHeight={rowHeight}
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
        <div
          role="tooltip"
          className="pointer-events-none fixed z-50 w-80 rounded-lg bg-slate-900 p-3 text-slate-100 shadow-xl"
          style={{
            left: Math.min(tip.rect.left, window.innerWidth - 330),
            top: tip.rect.bottom + 6,
          }}
        >
          {detail(tip.key)}
        </div>
      )}

      {sheet && (
        <div
          role="dialog"
          aria-modal
          aria-label="Cell detail"
          className="fixed inset-0 z-50 flex items-end bg-black/40"
          onClick={() => {
            setSheet(null);
          }}
        >
          <div
            className="w-full rounded-t-xl bg-slate-900 p-4 text-slate-100"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {detail(sheet)}
            <button
              type="button"
              className="mt-3 text-sm text-sky-400"
              onClick={() => {
                setSheet(null);
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
