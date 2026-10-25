/**
 * The board grid (spec.md §4.4): stage headers across, row headers down,
 * one cell per row and stage, with row and column groups (C-14b). The
 * grid fills its container; every cell is the same size, so all cells show
 * the same detail level, chosen from the measured cell width (C-13). Hover
 * or focus shows a tooltip; a touch tap, or Space on a focused cell, opens
 * a detail sheet. Every row header, stage header, labelled group label and
 * cell has a settings gear (spec.md §3.11), sized from the named gear
 * constants in ems of the board's text, so gears scale with zoom.
 *
 * @module
 */
import { Fragment, useState } from 'react';

import type { Dashboard } from '@/domain/config/dashboard';
import { groupSegments } from '@/domain/groups/segments';
import { type BoardModel, cellKey } from '@/engine';
import { cn } from '@/lib/utils';

import { CellDetail, CellSheet, CellTooltip } from './CellDetail';
import { cellNames, cellSettingsAt } from './cellNames';
import { cellPlace } from './cellView';
import { columnLines } from './columnFrame';
import { ColumnGroupLabels } from './ColumnGroupLabels';
import { GridCell } from './GridCell';
import { BOUNDARY } from './gridStyles';
import { type Layout, LINE_HEIGHT } from './layout';
import { useProblemMarks } from './problemMarksContext';
import { RowGroupLabel, RowHeader } from './RowHeaders';
import { SettingsGear } from './SettingsGear';
import {
  HEADER_GEAR_GAP,
  SETTINGS_GEAR_INSET,
  SETTINGS_GEAR_SIZE,
} from './settingsGearSize';
import { useSettingsPopup } from './settingsPopupContext';
import { StageHeaders } from './StageHeaders';
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

  const [tip, setTip] = useState<{
    key: string;
    rect: DOMRect;
    /** The cell has focus, so the details key works: say so. */
    focused: boolean;
  } | null>(null);
  const [sheet, setSheet] = useState<{
    key: string;
    rowId: string;
    stageId: string;
  } | null>(null);
  const hasSettings = useSettingsPopup() !== null;
  const names = (key: string) => cellNames(dashboard, key);
  const detail = (key: string, gear?: React.ReactNode) => {
    const cell = model.cells[key];
    return cell ? (
      <CellDetail
        cell={cell}
        interactive={gear !== undefined}
        problems={marks.cells.get(key)}
        settings={gear === undefined ? [] : cellSettingsAt(dashboard, key)}
        gear={hasSettings && gear}
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
            // The settings gears (spec.md §3.11), in ems of the text.
            '--gear-size': `${String(SETTINGS_GEAR_SIZE * layout.fontPx)}px`,
            '--gear-inset': `${String(SETTINGS_GEAR_INSET * layout.fontPx)}px`,
            '--gear-gap': `${String(HEADER_GEAR_GAP * layout.fontPx)}px`,
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
        <StageHeaders
          stages={stages}
          lines={lines}
          frameTop={frameTop}
          pinTop={pinTop}
          pinLeft={pinLeft}
          style={lineRow}
        />
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
              {label && segment.group && (
                <RowGroupLabel
                  group={segment.group}
                  label={label}
                  boundary={si > 0}
                  style={lineRow}
                />
              )}
              {segmentRows.map((row, ri) => {
                const rowLine =
                  lineOnRow && ri === 0 ? BOUNDARY.top : undefined;
                return (
                  <div key={row.id} role="row" className="contents">
                    <RowHeader
                      row={row}
                      className={cn(pinLeft, rowLine)}
                      style={cellRow}
                    />
                    {stages.map((stage) => {
                      const key = cellKey(row.id, stage.id);
                      return (
                        <GridCell
                          key={key}
                          rowId={row.id}
                          stageId={stage.id}
                          className={cn(
                            'transition-opacity',
                            filter &&
                              !matchesFilter(model.cells[key], filter) &&
                              'opacity-25',
                            rowLine,
                            lines.bodyLeft.has(stage.id) && BOUNDARY.left,
                            lines.bodyRight.has(stage.id) && BOUNDARY.right,
                          )}
                          style={cellRow}
                          cell={model.cells[key]}
                          rung={layout.rung}
                          lineOf={layout.lineOf}
                          now={now}
                          onInspect={(el) => {
                            setTip(
                              el
                                ? {
                                    key,
                                    rect: el.getBoundingClientRect(),
                                    focused: el === document.activeElement,
                                  }
                                : null,
                            );
                          }}
                          onOpenSheet={() => {
                            setSheet({ key, rowId: row.id, stageId: stage.id });
                          }}
                        />
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
        <CellTooltip
          rect={tip.rect}
          keyHint={tip.focused}
          settingsHint={hasSettings}
        >
          {detail(tip.key)}
        </CellTooltip>
      )}
      {sheet && (
        <CellSheet
          title={cellPlace(names(sheet.key))}
          onClose={() => {
            setSheet(null);
          }}
        >
          {detail(
            sheet.key,
            <SettingsGear
              place={{
                level: 'cell',
                rowId: sheet.rowId,
                stageId: sheet.stageId,
              }}
              spot="sheet"
            />,
          )}
        </CellSheet>
      )}
    </>
  );
}
