/**
 * The board grid (spec.md §4.4): stage headers across, row headers down,
 * one cell per row and stage, with row and column groups (C-14b) framed
 * and divided in gutters of their own (spec.md §3.7, `groupGutters`). The
 * grid fills its container; every cell is the same size, so all cells show
 * the same detail level, chosen from the measured cell width (C-13). Hover
 * or focus shows a tooltip; a touch tap, or Space on a focused cell, opens
 * a detail sheet. Every row header, stage header and labelled group label
 * has a settings gear (spec.md §3.11), except on a narrow screen
 * (`Layout.headerGears`), and one gear follows the cell under the pointer
 * or keyboard focus (`CellGearLayer`). Gears are sized from the named gear
 * constants in ems of the board's text, so they scale with zoom. A cell's
 * tooltip stays open while the pointer or focus moves between the cell,
 * its badge and its gear, and closes when it leaves them all (`withinCell`,
 * issue #42); it is hidden while a settings popup is open.
 *
 * @module
 */
import { useState } from 'react';

import type { Dashboard } from '@/domain/config/dashboard';
import type { BoardModel } from '@/engine';

import { BoardRows } from './BoardRows';
import { controlHasFocus, withinCell } from './cellBox';
import { CellDetail, CellSheet, CellTooltip } from './CellDetail';
import { CellGearLayer } from './CellGearLayer';
import { cellNames, cellSettingsAt } from './cellNames';
import { cellPlace } from './cellView';
import { ColumnGroupLabels } from './ColumnGroupLabels';
import { boardTextStyle } from './gridStyles';
import { ColumnFrames } from './GroupFrames';
import {
  boardGroups,
  columnTracks,
  rowTracks,
  trackTemplate,
} from './groupGutters';
import { HeaderGearsContext } from './headerGears';
import { type Layout } from './layout';
import { useProblemMarks } from './problemMarksContext';
import { SettingsGear } from './SettingsGear';
import { useSettingsPopup } from './settingsPopupContext';
import { StageHeaders } from './StageHeaders';
import type { CellFilter } from './summary';

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
  const { rows, stages } = dashboard;
  const marks = useProblemMarks();
  const groups = boardGroups(dashboard);
  const tracks = columnTracks(groups.columnSegments);

  const [tip, setTip] = useState<{
    key: string;
    /** The cell's box, which the pointer or focus may leave only for its
     * own badge or gear. */
    el: HTMLElement;
    rect: DOMRect;
    /** The cell has focus, so the details key works: say so. */
    focused: boolean;
  } | null>(null);
  const [sheet, setSheet] = useState<{
    key: string;
    rowId: string;
    stageId: string;
  } | null>(null);
  const popup = useSettingsPopup();
  const hasSettings = popup !== null;
  /** The pointer or focus left a cell or the cell gear, for `to`: the
   * tooltip closes unless `to` is still in its cell as a whole. */
  const leave = (to: EventTarget | null | undefined) => {
    setTip((shown) => (shown && withinCell(shown.el, to) ? shown : null));
  };
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

  // Exact tracks: columns never stretch to their content (C-13), and the
  // gutters are tracks of their own (spec.md §3.7), as the layout counts
  // them, so the board's size is the layout's.
  const gutters = new Set(tracks.gutters);
  const columns = trackTemplate([
    layout.rowNameWidth,
    ...Array.from({ length: stages.length + gutters.size }, (_, i) =>
      gutters.has(i + 2) ? layout.gutter : layout.colWidth,
    ),
  ]);
  const gridRows = trackTemplate(
    rowTracks(groups.rowSegments, groups.strip).map((kind) =>
      kind === 'cell'
        ? layout.rowHeight
        : kind === 'line'
          ? layout.lineRowHeight
          : layout.gutter,
    ),
  );
  const lineRow = { height: layout.lineRowHeight };
  const cellStyles = tracks.stageColumn.map((column) => ({
    height: layout.rowHeight,
    gridColumn: String(column),
  }));

  return (
    <HeaderGearsContext value={layout.headerGears}>
      <CellGearLayer style={boardTextStyle(layout)} onLeave={leave}>
        <div
          role="grid"
          aria-label={dashboard.name}
          data-rung={layout.rung}
          data-format={layout.format}
          aria-rowcount={rows.length + 1}
          aria-colcount={stages.length + 1}
          // Relative: the column frames are placed in its grid areas.
          className="relative grid w-max"
          style={
            {
              gridTemplateColumns: columns,
              gridTemplateRows: gridRows,
              gap: layout.gap,
              '--cell-pad-x': `${String(layout.padX)}px`,
              '--cell-pad-y': `${String(layout.padY)}px`,
              // What the pinned covers over the frames span (§3.7).
              '--row-name-w': `${String(layout.rowNameWidth)}px`,
              '--grid-gap': `${String(layout.gap)}px`,
              // The label strip and the gap below it (C-14b).
              '--strip-h': groups.strip
                ? `${String(layout.lineRowHeight + layout.gap)}px`
                : '0px',
            } as React.CSSProperties
          }
        >
          <ColumnGroupLabels
            segments={groups.columnSegments}
            columns={tracks.stageColumn}
            rowHeight={layout.lineRowHeight}
            gap={layout.gap}
            labelLeft={layout.rowNameWidth + layout.gap}
          />
          <StageHeaders
            stages={stages}
            columns={tracks.stageColumn}
            style={lineRow}
          />
          <BoardRows
            dashboard={dashboard}
            segments={groups.rowSegments}
            model={model}
            layout={layout}
            now={now}
            filter={filter}
            cellStyles={cellStyles}
            onInspect={(key, el, to) => {
              if (el)
                setTip({
                  key,
                  el,
                  rect: el.getBoundingClientRect(),
                  focused: controlHasFocus(el),
                });
              else leave(to);
            }}
            onOpenSheet={(key, rowId, stageId) => {
              setSheet({ key, rowId, stageId });
            }}
          />
          <ColumnFrames frames={tracks.frames} gutter={layout.gutter} />
        </div>
      </CellGearLayer>

      {tip && !sheet && !popup?.request && (
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
    </HeaderGearsContext>
  );
}
