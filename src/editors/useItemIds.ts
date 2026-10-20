/**
 * Stable identities for the items of a list whose items carry none (a
 * source rule's keys: names repeat while being edited): an id per
 * position that follows its item through renames and through removing
 * or adding others. The list reports its own removals and additions; a
 * change it didn't report (a different list) keeps the first ids and
 * adds or drops at the end.
 *
 * @module
 */
import { useState } from 'react';

const newId = (): string => crypto.randomUUID();

const ids = (n: number): string[] => Array.from({ length: n }, newId);

export interface ItemIds {
  /** One id per item, in order. */
  ids: readonly string[];
  /** Call alongside appending an item. */
  added: () => void;
  /** Call alongside removing the item at `index`. */
  removed: (index: number) => void;
}

export function useItemIds(length: number): ItemIds {
  const [state, setState] = useState<string[]>(() => ids(length));
  let current = state;
  // Brought up to date during render when the list changed unreported.
  if (state.length !== length) {
    current =
      length > state.length
        ? [...state, ...ids(length - state.length)]
        : state.slice(0, length);
    setState(current);
  }
  return {
    ids: current,
    added: () => {
      setState((s) => [...s, newId()]);
    },
    removed: (index) => {
      setState((s) => s.filter((_, j) => j !== index));
    },
  };
}
