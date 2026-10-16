/**
 * Fit, zoom and row height around the board grid (spec.md C-13). At Fit
 * the grid fills the viewport; zooming makes the grid a multiple of the
 * viewport and the viewport scrolls, with headers pinned and a mini-map
 * showing the visible part. Zoom is the grid's own (browser zoom is left
 * alone outside it):
 * - desktop: Ctrl/Cmd + wheel or trackpad pinch, the -/Fit/+ buttons, and
 *   `+`, `-`, `0` while the grid has focus;
 * - touch: pinch, or double-tap to zoom in a step (`touch-action: none`
 *   on the grid only).
 *
 * @module
 */
import { Minus, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import type { Dashboard } from '@/domain/config/dashboard';
import type { BoardModel } from '@/engine';
import { cn } from '@/lib/utils';

import { BoardGrid } from './BoardGrid';
import type { CellFilter } from './summary';
import type { BoardView } from './useBoardView';
import { MIN_ZOOM, stepZoom, wheelZoom } from './zoom';

const DOUBLE_TAP_MS = 300;

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
  const { zoom, setZoom, rowHeight, setRowHeight } = view;
  const scroller = useRef<HTMLDivElement>(null);
  // The native wheel listener reads the latest zoom through refs, updated
  // after each render (refs may not be written during render).
  const zoomRef = useRef(zoom);
  const setZoomRef = useRef(setZoom);
  useEffect(() => {
    zoomRef.current = zoom;
    setZoomRef.current = setZoom;
  });

  // Ctrl/Cmd + wheel (and trackpad pinch, which arrives as ctrl + wheel)
  // zooms the grid. React's wheel listener is passive, so attach natively.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      setZoomRef.current(wheelZoom(zoomRef.current, e.deltaY));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
    };
  }, []);

  // Touch: two-pointer pinch and double-tap.
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const lastTap = useRef(0);
  const distance = () => {
    const points = [...pointers.current.values()];
    const a = points.at(0);
    const b = points.at(1);
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };

  // Mini-map: the visible fraction of the grid.
  const [visible, setVisible] = useState({ x: 0, y: 0, w: 1, h: 1 });
  const measure = () => {
    const el = scroller.current;
    if (!el || el.scrollWidth === 0) return;
    setVisible({
      x: el.scrollLeft / el.scrollWidth,
      y: el.scrollTop / el.scrollHeight,
      w: el.clientWidth / el.scrollWidth,
      h: el.clientHeight / el.scrollHeight,
    });
  };
  useEffect(measure, [zoom]);

  const zoomed = zoom > MIN_ZOOM;

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <div
          role="group"
          aria-label="Row height"
          className="inline-flex overflow-hidden rounded-md border"
        >
          {(['compact', 'full'] as const).map((h) => (
            <button
              key={h}
              type="button"
              aria-pressed={rowHeight === h}
              className={cn(
                'px-2 py-0.5 text-xs capitalize',
                rowHeight === h
                  ? 'bg-foreground text-background'
                  : 'bg-background',
              )}
              onClick={() => {
                setRowHeight(h);
              }}
            >
              {h}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="icon"
            variant="outline"
            aria-label="Zoom out"
            disabled={!zoomed}
            onClick={() => {
              setZoom(stepZoom(zoom, -1));
            }}
          >
            <Minus className="size-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            aria-label="Fit board to screen"
            disabled={!zoomed}
            onClick={() => {
              setZoom(MIN_ZOOM);
            }}
          >
            Fit
          </Button>
          <Button
            size="icon"
            variant="outline"
            aria-label="Zoom in"
            onClick={() => {
              setZoom(stepZoom(zoom, 1));
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
          aria-label="Board: plus and minus zoom, 0 fits"
          className={cn(
            'h-full touch-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring',
            zoomed ? 'overflow-auto' : 'overflow-hidden',
          )}
          onScroll={measure}
          onKeyDown={(e) => {
            if (e.ctrlKey || e.metaKey) return; // browser zoom stays browser zoom
            if (e.key === '+' || e.key === '=') setZoom(stepZoom(zoom, 1));
            else if (e.key === '-') setZoom(stepZoom(zoom, -1));
            else if (e.key === '0') setZoom(MIN_ZOOM);
            else return;
            e.preventDefault();
          }}
          onPointerDown={(e) => {
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (pointers.current.size === 2) {
              pinch.current = { distance: distance(), zoom };
            }
            if (e.pointerType === 'touch' && pointers.current.size === 1) {
              const t = e.timeStamp;
              if (t - lastTap.current < DOUBLE_TAP_MS) {
                setZoom(stepZoom(zoom, 1));
                lastTap.current = 0;
              } else lastTap.current = t;
            }
          }}
          onPointerMove={(e) => {
            if (!pointers.current.has(e.pointerId)) return;
            pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
            const start = pinch.current;
            if (start && start.distance > 0) {
              setZoom((start.zoom * distance()) / start.distance);
            }
          }}
          onPointerUp={(e) => {
            pointers.current.delete(e.pointerId);
            if (pointers.current.size < 2) pinch.current = null;
          }}
          onPointerCancel={(e) => {
            pointers.current.delete(e.pointerId);
            pinch.current = null;
          }}
        >
          <div
            style={{
              width: `${String(zoom * 100)}%`,
              height: `${String(zoom * 100)}%`,
              fontSize: `${String(Math.min(zoom, 2))}em`,
            }}
          >
            <BoardGrid
              dashboard={dashboard}
              model={model}
              rowHeight={rowHeight}
              now={now}
              pinnedHeaders={zoomed}
              filter={filter}
            />
          </div>
        </div>

        {zoomed && (
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-2 right-2 h-16 w-24 rounded border bg-background/80 shadow"
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
