/**
 * The status sets a board's cells use (spec.md A§4.3.6), each once, in
 * board order: what the legend lists. Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import type { StatusSet } from '@/domain/config/statusSets';
import { statusSetFor } from '@/domain/statuses/resolve';

export function legendSets(dashboard: Dashboard): StatusSet[] {
  const sets = new Map<string, StatusSet>();
  for (const row of dashboard.rows)
    for (const stage of dashboard.stages) {
      const set = statusSetFor(dashboard, row, stage.id);
      if (!sets.has(set.id)) sets.set(set.id, set);
    }
  return [...sets.values()];
}
