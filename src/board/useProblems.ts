/**
 * The board's problems (spec.md A§4.3.7): the configuration's own and
 * those found while reading, without the ones dismissed on this device.
 *
 * @module
 */
import { useMemo, useState } from 'react';

import type { Dashboard } from '@/domain/config/dashboard';
import type { Problem } from '@/domain/problems/problem';
import { configProblems } from '@/domain/problems/problems';
import type { BoardModel } from '@/engine';
import { useStores } from '@/storage/storesContext';

export interface BoardProblems {
  /** Problems not dismissed. */
  shown: Problem[];
  dismiss: (id: string) => void;
}

export function useProblems(
  dashboard: Dashboard,
  model: BoardModel,
): BoardProblems {
  const { preferences } = useStores();
  const [dismissed, setDismissed] = useState(
    () => new Set(preferences.getView(dashboard.id).dismissedProblems),
  );
  const own = useMemo(() => configProblems(dashboard), [dashboard]);
  const shown = [...own, ...model.problems].filter((p) => !dismissed.has(p.id));
  const dismiss = (id: string) => {
    const next = new Set(dismissed).add(id);
    preferences.setView(dashboard.id, { dismissedProblems: [...next] });
    setDismissed(next);
  };
  return { shown, dismiss };
}
