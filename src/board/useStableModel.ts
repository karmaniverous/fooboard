/**
 * The board model the layout is sized from (spec.md C-13): polled data
 * changes reach the layout at most once per idle polling interval, never
 * while the user is interacting, so the board doesn't change shape under
 * the pointer. A new board shape, or the first data after loading, applies
 * at once, as does any increase in filled cells (rows load one by one).
 * Cells themselves always render the live model.
 *
 * @module
 */
import { useEffect, useRef, useState } from 'react';

import type { BoardModel } from '@/engine';
import { IDLE_INTERVAL_MS } from '@/query/intervals';

/** At most this often (the idle polling interval). */
const LAYOUT_DATA_INTERVAL_MS = IDLE_INTERVAL_MS;

const filled = (m: BoardModel) => Object.keys(m.cells).length;

export function useStableModel(
  model: BoardModel,
  shapeKey: string,
  isInteracting: () => boolean,
): BoardModel {
  const [snap, setSnap] = useState({ model, shapeKey });
  let current = snap;
  // Rows load one by one: newly filled cells apply at once; updates to
  // cells already shown wait for the interval.
  if (snap.shapeKey !== shapeKey || filled(model) > filled(snap.model)) {
    current = { model, shapeKey };
    setSnap(current);
  }

  const latest = useRef(model);
  const interacting = useRef(isInteracting);
  useEffect(() => {
    latest.current = model;
    interacting.current = isInteracting;
  });
  useEffect(() => {
    const id = setInterval(() => {
      if (interacting.current()) return;
      setSnap((s) =>
        s.model === latest.current ? s : { ...s, model: latest.current },
      );
    }, LAYOUT_DATA_INTERVAL_MS);
    return () => {
      clearInterval(id);
    };
  }, []);
  return current.model;
}
