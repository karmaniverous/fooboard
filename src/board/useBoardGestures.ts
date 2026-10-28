/**
 * The board grid's zoom and pan gestures (spec.md C-13; Decision 76):
 * - desktop: Ctrl/Cmd + wheel or trackpad pinch zooms, `+`, `-`, `0` zoom
 *   while the grid has focus, and a mouse drag pans an overflowing grid;
 * - touch: pinch to zoom (no double tap: a tap opens the cell it lands on,
 *   so a double tap could never reach the board; Decision 78). The grid's
 *   `touch-action: pan-x pan-y` leaves one-finger scrolling to the browser
 *   (native, with momentum); the code pans only for a mouse. Panning the
 *   page from `pointermove` instead made touch scrolling jerk (#47).
 *
 * A drag never activates the cell it started on: a mouse drag swallows the
 * click that ends it, and a native touch scroll cancels the pointer
 * (`pointercancel`), so no click follows.
 *
 * @module
 */
import { useCallback, useEffect, useRef } from 'react';

import { snapZoom, stepZoom, type ZoomRange } from './zoom';

/** Movement (px) after which a press is a drag, not a tap or click. */
const DRAG_THRESHOLD = 8;
/** How long after the last pointer, wheel or hover activity the user
 * counts as interacting (layout data updates wait). */
const INTERACTION_MS = 5_000;
/** Accumulated wheel delta that makes one 10% zoom step. */
const WHEEL_STEP_DELTA = 50;
/** The one pointer the code pans the page for; the browser pans the rest. */
const PANNING_POINTER = 'mouse';

type Point = { x: number; y: number };

/** Whether the user is interacting with the board: a pointer is down, or
 * there was pointer, wheel or hover activity in the last few seconds. */
export interface Interaction {
  /** Pointers down on the grid, by id. */
  pointers: React.RefObject<Map<number, Point>>;
  /** Record activity now. */
  note: () => void;
  /** Whether layout data updates should wait. */
  isInteracting: () => boolean;
}

/** Track interaction; `held` (e.g. an open popup) always counts. */
export function useInteraction(held: boolean): Interaction {
  const pointers = useRef(new Map<number, Point>());
  const last = useRef(0);
  return {
    pointers,
    note: () => {
      last.current = Date.now();
    },
    isInteracting: () =>
      held ||
      pointers.current.size > 0 ||
      Date.now() - last.current < INTERACTION_MS,
  };
}

/** What the gestures change. */
export interface ZoomControls {
  zoom: number;
  setZoom: (zoom: number) => void;
  range: ZoomRange;
  /** The board is larger than the grid area (the page scrolls). */
  scrolls: boolean;
}

/** Native listeners: Ctrl/Cmd + wheel zoom (React's wheel listener is
 * passive), and a two-finger touch kept from scrolling so it can pinch. */
function useNativeListeners(
  scroller: React.RefObject<HTMLElement | null>,
  interaction: Interaction,
  controls: ZoomControls,
) {
  const latest = useRef({ controls, note: interaction.note });
  useEffect(() => {
    latest.current = { controls, note: interaction.note };
  });
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    // A mouse notch (deltaY ~100) is one 10% step; trackpad pinches
    // arrive as many small deltas and add up to steps.
    let accumulated = 0;
    const onWheel = (e: WheelEvent) => {
      latest.current.note();
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      accumulated += e.deltaY;
      if (Math.abs(accumulated) < WHEEL_STEP_DELTA) return;
      const { zoom, setZoom, range } = latest.current.controls;
      setZoom(stepZoom(zoom, accumulated < 0 ? 1 : -1, range));
      accumulated = 0;
    };
    // `pan-x pan-y` lets the browser scroll with two fingers too, which
    // would cancel a pinch; once it scrolls, the move can't be cancelled.
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1 && e.cancelable) e.preventDefault();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchmove', onTouchMove);
    };
  }, [scroller]);
}

/** The gestures: a zoom step (for the toolbar too), and the props to
 * spread on the grid element. */
export interface BoardGestures {
  step: (direction: 1 | -1) => void;
  props: Pick<
    React.HTMLAttributes<HTMLElement>,
    | 'onMouseMove'
    | 'onKeyDown'
    | 'onPointerDown'
    | 'onPointerMove'
    | 'onPointerUp'
    | 'onPointerCancel'
    | 'onClickCapture'
  >;
}

/** The grid's gestures. */
export function useBoardGestures(
  scroller: React.RefObject<HTMLElement | null>,
  interaction: Interaction,
  controls: ZoomControls,
): BoardGestures {
  const { zoom, setZoom, range, scrolls } = controls;
  const { pointers, note } = interaction;
  useNativeListeners(scroller, interaction, controls);

  const step = (direction: 1 | -1) => {
    setZoom(stepZoom(zoom, direction, range));
  };
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const press = useRef<(Point & { dragged: boolean }) | null>(null);
  const distance = () => {
    const points = [...pointers.current.values()];
    const a = points.at(0);
    const b = points.at(1);
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
  };
  const release = useCallback(
    (id: number) => {
      pointers.current.delete(id);
      if (pointers.current.size < 2) pinch.current = null;
    },
    [pointers],
  );
  // A pointer let go off the grid (before a drag captures it) ends there:
  // forget it too, or the board stays "interacting" and the next press
  // would be taken for a pinch's second finger.
  useEffect(() => {
    const end = (e: PointerEvent) => {
      release(e.pointerId);
    };
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    return () => {
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
  }, [release]);
  return {
    step,
    props: {
      onMouseMove: note,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey) return; // browser zoom stays browser zoom
        if (e.key === '+' || e.key === '=') step(1);
        else if (e.key === '-') step(-1);
        else if (e.key === '0') setZoom(1);
        else return;
        e.preventDefault();
      },
      onPointerDown: (e: React.PointerEvent) => {
        note();
        pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.current.size === 1) {
          press.current = { x: e.clientX, y: e.clientY, dragged: false };
        }
        if (pointers.current.size === 2) {
          pinch.current = { distance: distance(), zoom };
          if (press.current) press.current.dragged = true; // not a tap
        }
      },
      onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
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
        if (!p || !scrolls) return;
        // Any pointer's drag swallows the click that may end it.
        if (
          !p.dragged &&
          Math.hypot(e.clientX - p.x, e.clientY - p.y) > DRAG_THRESHOLD
        ) {
          p.dragged = true;
          // Capture only once it is a drag, so clicks still reach cells.
          if (e.pointerType === PANNING_POINTER) {
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              // not supported (e.g. test DOM); panning still works
            }
          }
        }
        // The page scrolls, not the grid (C-13); the browser pans touch.
        if (p.dragged && e.pointerType === PANNING_POINTER) {
          window.scrollBy(last.x - e.clientX, last.y - e.clientY);
        }
      },
      onPointerUp: (e: React.PointerEvent) => {
        release(e.pointerId);
      },
      onPointerCancel: (e: React.PointerEvent) => {
        release(e.pointerId);
        press.current = null;
      },
      onClickCapture: (e: React.MouseEvent) => {
        // A drag or pinch ends with a click on the cell it started on;
        // swallow it so panning never opens a job or a sheet.
        if (press.current?.dragged) {
          e.preventDefault();
          e.stopPropagation();
        }
        press.current = null;
      },
    },
  };
}
