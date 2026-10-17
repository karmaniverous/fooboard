/**
 * The board's grid area (spec.md C-13): measures the space the board gets,
 * chooses the layout for the current zoom and density, and scrolls the
 * grid when it is larger than that space (headers pinned, mini-map).
 *
 * Zoom is one scale (see `layout.ts`):
 * - desktop: Ctrl/Cmd + wheel or trackpad pinch, the -/100%/+ buttons, and
 *   `+`, `-`, `0` while the grid has focus;
 * - touch: pinch, or double-tap to zoom in a step.
 *
 * The grid sets `touch-action: none` (so pinch is ours) and therefore pans
 * itself: a one-finger or mouse drag scrolls an overflowing grid, and a
 * drag never activates the cell it started on.
 *
 * @module
 */
import { Minus, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { ToggleButton } from '@/components/ToggleButton';
import { Button } from '@/components/ui/button';
import type { Dashboard } from '@/domain/config/dashboard';
import type { Density } from '@/domain/config/devicePreferences';
import type { BoardModel } from '@/engine';
import { cn } from '@/lib/utils';

import { BoardGrid } from './BoardGrid';
import {
  clampZoom,
  layoutAtZoom,
  type LayoutInput,
  stepZoom,
  wheelZoom,
  zoomLabel,
  zoomRange,
} from './layout';
import { boardContents } from './layoutContents';
import type { CellFilter } from './summary';
import { createTextMeasure } from './textMeasure';
import type { BoardView } from './useBoardView';
import { useStableModel } from './useStableModel';

const DOUBLE_TAP_MS = 300;
/** Movement (px) after which a press is a drag, not a tap or click. */
const DRAG_THRESHOLD = 8;
/** How long after the last pointer, wheel or hover activity the user
 * counts as interacting (layout data updates wait). */
const INTERACTION_MS = 5_000;
const DENSITIES: Density[] = ['compact', 'default', 'comfortable'];

/** The grid area's size, tracked as it changes. */
function useAreaSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight });
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [ref]);
  return size;
}

export function BoardViewport({
  dashboard,
  model,
  now,
  view,
  filter = null,
}: {
  dashboard: Dashboard;
  model: BoardModel;
  now: number;
  view: BoardView;
  filter?: CellFilter | null;
}): React.JSX.Element {
  const { zoom, setZoom, density, setDensity } = view;
  const scroller = useRef<HTMLDivElement>(null);
  const area = useAreaSize(scroller);
  const [measure] = useState(createTextMeasure);

  const lastActivity = useRef(0);
  const touch = () => {
    lastActivity.current = Date.now();
  };
  const sizingModel = useStableModel(
    model,
    `${dashboard.id}:${String(dashboard.rows.length)}x${String(dashboard.stages.length)}`,
    () => Date.now() - lastActivity.current < INTERACTION_MS,
  );

  const input: LayoutInput = useMemo(
    () => ({
      // Before the first measurement (and in tests), assume a laptop.
      width: area.width || 1280,
      height: area.height || 720,
      rows: dashboard.rows.length,
      stages: dashboard.stages.length,
      labelRows:
        dashboard.rowDividers.filter((d) => d.label).length +
        (dashboard.columnDividers.some((d) => d.label) ? 1 : 0),
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
  const scrolls = layout.overflowX || layout.overflowY;

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
    const onWheel = (e: WheelEvent) => {
      lastActivity.current = Date.now();
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const l = latest.current;
      l.setZoom(wheelZoom(l.zoom, e.deltaY, l.range));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  const step = (direction: 1 | -1) => {
    setZoom(stepZoom(zoom, direction, range));
  };

  // Pointer state: pinch (two pointers), pan (one), double-tap.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
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

  // Mini-map: the visible fraction of the grid.
  const [visible, setVisible] = useState({ x: 0, y: 0, w: 1, h: 1 });
  const measureVisible = () => {
    const el = scroller.current;
    if (!el || el.scrollWidth === 0) return;
    setVisible({
      x: el.scrollLeft / el.scrollWidth,
      y: el.scrollTop / el.scrollHeight,
      w: el.clientWidth / el.scrollWidth,
      h: el.clientHeight / el.scrollHeight,
    });
  };
  useEffect(measureVisible, [layout]);

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="group"
          aria-label="Density"
          className="inline-flex overflow-hidden rounded-md border"
        >
          {DENSITIES.map((d) => (
            <ToggleButton
              key={d}
              pressed={density === d}
              className="px-2 py-0.5 capitalize"
              onClick={() => {
                setDensity(d);
              }}
            >
              {d}
            </ToggleButton>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="icon"
            variant="outline"
            aria-label="Zoom out"
            disabled={zoom <= range.min}
            onClick={() => {
              step(-1);
            }}
          >
            <Minus className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-label="Zoom to 100%"
            title="Zoom to 100%"
            className="min-w-[6.5rem] tabular-nums"
            onClick={() => {
              setZoom(1);
            }}
          >
            {zoomLabel(zoom, range)}
          </Button>
          <Button
            size="icon"
            variant="outline"
            aria-label="Zoom in"
            disabled={zoom >= range.max}
            onClick={() => {
              step(1);
            }}
          >
            <Plus className="size-4" />
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <div
          ref={scroller}
          tabIndex={0}
          aria-label="Board: plus and minus zoom, 0 returns to 100%"
          className={cn(
            'h-full touch-none overflow-auto rounded-md outline-none [scrollbar-gutter:stable] focus-visible:ring-2 focus-visible:ring-ring',
            scrolls && 'select-none',
          )}
          onScroll={measureVisible}
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
                  clampZoom((start.zoom * distance()) / start.distance, range),
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
              el.scrollLeft -= e.clientX - last.x;
              el.scrollTop -= e.clientY - last.y;
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

        {scrolls && (
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-2 right-4 z-30 h-16 w-24 rounded border bg-background/80 shadow"
          >
            <div
              className="absolute rounded-sm border-2 border-status-started"
              style={{
                left: `${String(visible.x * 100)}%`,
                top: `${String(visible.y * 100)}%`,
                width: `${String(visible.w * 100)}%`,
                height: `${String(visible.h * 100)}%`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
