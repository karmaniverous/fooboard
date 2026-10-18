/**
 * The board's grid area (spec.md C-13): measures the space the board gets,
 * chooses the layout for the current zoom and density, and scrolls the
 * page when the grid is larger than that space (headers pinned).
 *
 * Zoom is one scale (see `layout.ts`):
 * - desktop: Ctrl/Cmd + wheel or trackpad pinch, the -/100%/+ buttons, and
 *   `+`, `-`, `0` while the grid has focus;
 * - touch: pinch, or double-tap to zoom in a step.
 *
 * The grid sets `touch-action: none` (so pinch is ours) and therefore pans
 * the page itself: a one-finger or mouse drag scrolls an overflowing grid, and a
 * drag never activates the cell it started on.
 *
 * @module
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import type { Dashboard } from '@/domain/config/dashboard';
import type { BoardModel } from '@/engine';
import { cn } from '@/lib/utils';

import { BoardGrid } from './BoardGrid';
import { BoardToolbar } from './BoardToolbar';
import { type LayoutInput } from './layout';
import { boardContents } from './layoutContents';
import type { CellFilter } from './summary';
import { createTextMeasure } from './textMeasure';
import type { BoardView } from './useBoardView';
import { useStableModel } from './useStableModel';
import { layoutAtZoom, snapZoom, stepZoom, zoomRange } from './zoom';

const DOUBLE_TAP_MS = 300;
/** Movement (px) after which a press is a drag, not a tap or click. */
const DRAG_THRESHOLD = 8;
/** How long after the last pointer, wheel or hover activity the user
 * counts as interacting (layout data updates wait). */
const INTERACTION_MS = 5_000;
/** Accumulated wheel delta that makes one 10% zoom step. */
const WHEEL_STEP_DELTA = 50;

/** The grid area (C-13): the window's width less the page's side margins,
 * and the window height below the grid's top when the page is scrolled to
 * the top. Both come from the window, never from the grid's own size:
 * the page grows with a wide grid, so measuring the grid would feed each
 * layout back into the next and never settle. */
function useAreaSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const top = rect.top + window.scrollY;
      const left = rect.left + window.scrollX;
      const windowWidth = document.documentElement.clientWidth;
      setSize({
        width: Math.max(0, windowWidth - 2 * left),
        height: Math.max(0, window.innerHeight - top - 8),
      });
    };
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, [ref]);
  return size;
}

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
  const area = useAreaSize(scroller);
  const [measure] = useState(createTextMeasure);

  const lastActivity = useRef(0);
  const touch = () => {
    lastActivity.current = Date.now();
  };
  // Pointer state: pinch (two pointers), pan (one), double-tap. A pointer
  // held down always counts as interacting, however long the gesture.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const sizingModel = useStableModel(
    model,
    `${dashboard.id}:${String(dashboard.rows.length)}x${String(dashboard.stages.length)}`,
    () =>
      pointers.current.size > 0 ||
      Date.now() - lastActivity.current < INTERACTION_MS,
  );

  const input: LayoutInput = useMemo(
    () => ({
      // Before the first measurement (and in tests), assume a laptop.
      width: area.width || 1280,
      height: area.height || 720,
      rows: dashboard.rows.length,
      stages: dashboard.stages.length,
      labelRows:
        dashboard.rowGroups.filter((g) => g.label).length +
        (dashboard.columnGroups.some((g) => g.label) ? 1 : 0),
      rowNames: dashboard.rows.map((r) => r.displayName),
      contents: boardContents(dashboard, sizingModel),
      measure,
      density,
    }),
    [area.width, area.height, dashboard, sizingModel, measure, density],
  );
  const range = useMemo(() => zoomRange(input), [input]);
  const layout = useMemo(
    () => layoutAtZoom(input, zoom, range),
    [input, zoom, range],
  );
  // The board is larger than the grid area (the page will scroll).
  const scrolls = layout.overflowX || layout.boardHeight > input.height + 0.5;

  // The native wheel listener reads the latest values through refs.
  const latest = useRef({ zoom, setZoom, range });
  useEffect(() => {
    latest.current = { zoom, setZoom, range };
  });

  // Ctrl/Cmd + wheel (and trackpad pinch, which arrives as ctrl + wheel)
  // zooms the grid. React's wheel listener is passive, so attach natively.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    // A mouse notch (deltaY ~100) is one 10% step; trackpad pinches
    // arrive as many small deltas and add up to steps.
    let accumulated = 0;
    const onWheel = (e: WheelEvent) => {
      lastActivity.current = Date.now();
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      accumulated += e.deltaY;
      if (Math.abs(accumulated) < WHEEL_STEP_DELTA) return;
      const l = latest.current;
      l.setZoom(stepZoom(l.zoom, accumulated < 0 ? 1 : -1, l.range));
      accumulated = 0;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  const step = (direction: 1 | -1) => {
    setZoom(stepZoom(zoom, direction, range));
  };

  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const press = useRef<{ x: number; y: number; dragged: boolean } | null>(null);
  const lastTap = useRef(0);
  const distance = () => {
    const points = [...pointers.current.values()];
    const a = points.at(0);
    const b = points.at(1);
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const release = (id: number) => {
    pointers.current.delete(id);
    if (pointers.current.size < 2) pinch.current = null;
  };

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
          ref={scroller}
          tabIndex={0}
          aria-label="Board: plus and minus zoom, 0 returns to 100%"
          className={cn(
            'touch-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring',
            scrolls && 'select-none',
          )}
          onMouseMove={touch}
          onKeyDown={(e) => {
            if (e.ctrlKey || e.metaKey) return; // browser zoom stays browser zoom
            if (e.key === '+' || e.key === '=') step(1);
            else if (e.key === '-') step(-1);
            else if (e.key === '0') setZoom(1);
            else return;
            e.preventDefault();
          }}
          onPointerDown={(e) => {
            touch();
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pointers.current.size === 1) {
              press.current = { x: e.clientX, y: e.clientY, dragged: false };
            }
            if (pointers.current.size === 2) {
              pinch.current = { distance: distance(), zoom };
              if (press.current) press.current.dragged = true; // not a tap
            }
            if (e.pointerType === 'touch' && pointers.current.size === 1) {
              const t = e.timeStamp;
              if (t - lastTap.current < DOUBLE_TAP_MS) {
                step(1);
                lastTap.current = 0;
              } else lastTap.current = t;
            }
          }}
          onPointerMove={(e) => {
            const last = pointers.current.get(e.pointerId);
            if (!last) return;
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            const start = pinch.current;
            if (start) {
              if (start.distance > 0) {
                setZoom(
                  snapZoom((start.zoom * distance()) / start.distance, range),
                );
              }
              return;
            }
            const p = press.current;
            const el = scroller.current;
            if (!p || !el || !scrolls) return;
            if (
              !p.dragged &&
              Math.hypot(e.clientX - p.x, e.clientY - p.y) > DRAG_THRESHOLD
            ) {
              p.dragged = true;
              // Capture only once it is a drag, so taps still reach cells.
              try {
                el.setPointerCapture(e.pointerId);
              } catch {
                // not supported (e.g. test DOM); panning still works
              }
            }
            if (p.dragged) {
              // The page scrolls, not the grid (C-13).
              window.scrollBy(last.x - e.clientX, last.y - e.clientY);
            }
          }}
          onPointerUp={(e) => {
            release(e.pointerId);
          }}
          onPointerCancel={(e) => {
            release(e.pointerId);
            press.current = null;
          }}
          onClickCapture={(e) => {
            // A drag or pinch ends with a click on the cell it started on;
            // swallow it so panning never opens a job or a sheet.
            if (press.current?.dragged) {
              e.preventDefault();
              e.stopPropagation();
            }
            press.current = null;
          }}
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
