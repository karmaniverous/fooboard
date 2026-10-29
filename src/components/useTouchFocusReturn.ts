/**
 * Focus returns to a panel's or popover's trigger as it closes, without
 * its tooltip when a touch opened it (spec 0.2.0 §3.A; Decision 98).
 * Radix's tooltip opens on any focus of its trigger not preceded by a
 * pointer press, so the programmatic focus return would leave a tooltip on
 * a touch screen with nothing to dismiss it. The trigger records whether
 * it was last pressed by touch; when it was, closing focuses it here
 * instead of by Radix, flagged, and the trigger's own focus handler
 * cancels that one focus, so the tooltip's handler, composed after it,
 * doesn't run. After a click or a key press, focus returns as usual, with
 * the tooltip, which names what just closed.
 *
 * @module
 */
import { useRef } from 'react';

/** Where a press came from (`PointerEvent.pointerType`). */
const TOUCH = 'touch';

/** Handlers for the trigger (spread on the element the tooltip wraps,
 * so they run before the tooltip's own) and for the content. */
export interface TouchFocusReturn {
  triggerProps: {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
    onKeyDown: () => void;
    onFocus: (e: React.FocusEvent<HTMLElement>) => void;
  };
  /** The content's `onCloseAutoFocus`. */
  onCloseAutoFocus: (e: Event) => void;
}

export function useTouchFocusReturn(): TouchFocusReturn {
  const trigger = useRef<HTMLElement | null>(null);
  /** The trigger was last pressed by touch. */
  const touched = useRef(false);
  /** The next focus of the trigger is the return after a touch. */
  const returning = useRef(false);
  return {
    triggerProps: {
      onPointerDown: (e) => {
        trigger.current = e.currentTarget;
        touched.current = e.pointerType === TOUCH;
      },
      onKeyDown: () => {
        touched.current = false;
      },
      onFocus: (e) => {
        if (!returning.current) return;
        returning.current = false;
        e.preventDefault();
      },
    },
    onCloseAutoFocus: (e) => {
      const el = trigger.current;
      if (!touched.current || !el?.isConnected) return;
      e.preventDefault();
      returning.current = true;
      el.focus();
      // Already focused: no focus event came to take the flag.
      returning.current = false;
    },
  };
}
