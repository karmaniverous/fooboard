/**
 * The board's grid area (spec.md C-13): measures the space the board gets,
 * chooses the layout for the current zoom and density, and scrolls the
 * page when the grid is larger than that space (headers pinned).
 *
 * Zoom is one scale (see `layout.ts`); the gestures that change it, and
 * the mouse drag that pans an overflowing grid, are `useBoardGestures`.
 * The grid's `touch-action: pan-x pan-y` leaves one-finger touch
 * scrolling to the browser, and keeps pinch for the code (Decisions 76
 * and 78).
 *
 * @module
 */
import { pick } from 'radash';
import { useMemo, useRef, useState } from 'react';

import { useMediaQuery } from '@/components/useMediaQuery';
import type { Dashboard } from '@/domain/config/dashboard';
import type { BoardModel } from '@/engine';
import { cn } from '@/lib/utils';

import { BoardGrid } from './BoardGrid';
import { BoardToolbar } from './BoardToolbar';
import { boardGroups } from './groupGutters';
import { type LayoutInput } from './layout';
import { boardContents } from './layoutContents';
import {
  SETTINGS_NARROW_QUERY,
  useSettingsPopup,
} from './settingsPopupContext';
import type { CellFilter } from './summary';
import { createTextMeasure } from './textMeasure';
import { useAreaSize } from './useAreaSize';
import { useBoardGestures, useInteraction } from './useBoardGestures';
import type { BoardView } from './useBoardView';
import { useStableModel } from './useStableModel';
import { layoutAtZoom, zoomRange } from './zoom';

/** The editable zoom percentage: Enter or leaving the field applies it,
 * snapped to 10% and clamped to the board's range (C-13). */
export function BoardViewport({
  dashboard,
  model,
  now,
  view,
  filter = null,
  lead,
}: {
  dashboard: Dashboard;
  model: BoardModel;
  now: number;
  view: BoardView;
  filter?: CellFilter | null;
  /** Start of the toolbar: the summary chips (C-14a). */
  lead?: (options: { words: boolean }) => React.ReactNode;
}): React.JSX.Element {
  const { zoom, setZoom, density, setDensity } = view;
  const scroller = useRef<HTMLDivElement>(null);
  // An element `100svh` tall: the viewport's height with the browser's
  // toolbars shown, which a scroll never changes (useAreaSize).
  const probe = useRef<HTMLDivElement>(null);
  const area = useAreaSize(scroller, probe);
  const [measure] = useState(createTextMeasure);
  // No header gears on a narrow screen (spec.md §3.11).
  const headerGears = !useMediaQuery(SETTINGS_NARROW_QUERY);

  // An open settings popup counts as interaction (spec.md §3.11).
  const interaction = useInteraction(useSettingsPopup()?.request != null);
  const sizingModel = useStableModel(
    model,
    `${dashboard.id}:${String(dashboard.rows.length)}x${String(dashboard.stages.length)}`,
    interaction.isInteracting,
  );

  const input: LayoutInput = useMemo(
    () => ({
      // Before the first measurement (and in tests), assume a laptop.
      width: area.width || 1280,
      height: area.height || 720,
      rows: dashboard.rows.length,
      stages: dashboard.stages.length,
      ...pick(boardGroups(dashboard), [
        'labelRows',
        'columnGutters',
        'rowGutters',
      ]),
      rowNames: dashboard.rows.map((r) => r.displayName),
      contents: boardContents(dashboard, sizingModel, headerGears),
      measure,
      density,
      headerGears,
    }),
    [
      area.width,
      area.height,
      dashboard,
      sizingModel,
      measure,
      density,
      headerGears,
    ],
  );
  const range = useMemo(() => zoomRange(input), [input]);
  const layout = useMemo(
    () => layoutAtZoom(input, zoom, range),
    [input, zoom, range],
  );
  // The board is larger than the grid area (the page will scroll).
  const scrolls = layout.overflowX || layout.boardHeight > input.height + 0.5;

  const { step, props: gestures } = useBoardGestures(scroller, interaction, {
    zoom,
    setZoom,
    range,
    scrolls,
  });

  return (
    <div className="flex flex-col gap-2">
      <BoardToolbar
        zoom={zoom}
        range={range}
        onZoom={setZoom}
        onStep={step}
        density={density}
        onDensity={setDensity}
        lead={lead}
      />

      <div className="relative">
        <div
          ref={probe}
          aria-hidden
          className="pointer-events-none invisible fixed top-0 left-0 h-svh w-0"
        />
        <div
          ref={scroller}
          tabIndex={0}
          aria-label="Board: plus and minus zoom, 0 returns to 100%"
          className={cn(
            // Pan natively; pinch is ours (Decisions 76 and 78).
            'touch-pan-x touch-pan-y rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring',
            scrolls && 'select-none',
          )}
          {...gestures}
        >
          <BoardGrid
            dashboard={dashboard}
            model={model}
            layout={layout}
            now={now}
            filter={filter}
          />
        </div>
      </div>
    </div>
  );
}
