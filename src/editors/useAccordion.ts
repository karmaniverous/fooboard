/**
 * Which item of an editor list is open (spec.md C-21): at most one, all
 * closed at first. The item the editor was opened on (a problem's *Fix*)
 * opens, and so does an item added while the list is shown, which also
 * scrolls into view.
 *
 * @module
 */
import { isEqual } from 'radash';
import { useContext, useState } from 'react';

import type { ItemOpenState } from '@/components/CollapsibleItem';

import { EditFocusContext, isFocused } from './editTarget';

/** A list item: its key, and the editor-item keys that open it (its
 * own, and any of what it holds, e.g. its row group's settings). */
export interface AccordionItem {
  key: string;
  targets: readonly string[];
}

export interface Accordion {
  /** `CollapsibleItem`'s open state for `key`: opening it closes any
   * other; it scrolls into view if it was the item last added. */
  itemProps: (key: string) => ItemOpenState;
}

interface State {
  open?: string;
  added?: string;
  /** The keys and focus the state was last brought up to date with. */
  keys: readonly string[];
  focus: readonly string[];
}

export function useAccordion(items: readonly AccordionItem[]): Accordion {
  const { focus } = useContext(EditFocusContext);
  const keys = items.map((i) => i.key);
  const focused = () =>
    items.find((i) => i.targets.some((t) => isFocused(focus, t)))?.key;
  const [state, setState] = useState<State>(() => ({
    open: focused(),
    keys,
    focus,
  }));
  // Brought up to date during render (React's pattern for state that
  // follows props): a new focus opens its item; one new key opens it.
  if (state.focus !== focus || !isEqual(state.keys, keys)) {
    const fresh = keys.filter((k) => !state.keys.includes(k));
    const added =
      state.focus === focus && fresh.length === 1 ? fresh[0] : undefined;
    setState({
      keys,
      focus,
      added: added ?? state.added,
      open:
        state.focus === focus
          ? (added ?? state.open)
          : (focused() ?? state.open),
    });
  }
  return {
    itemProps: (key) => ({
      open: state.open === key,
      onOpenChange: (open) => {
        setState((s) => ({
          ...s,
          open: open ? key : s.open === key ? undefined : s.open,
        }));
      },
      scrollIntoView: state.added === key,
    }),
  };
}
