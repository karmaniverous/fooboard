/**
 * Board chrome above the grid: the summary counts as filter toggles
 * (spec.md C-14a) and each credential's remaining GitHub budget (C-16).
 *
 * @module
 */
import { ToggleButton } from '@/components/ToggleButton';
import type { BoardModel } from '@/engine';
import { cn } from '@/lib/utils';

import { type CellFilter, FILTERS, summarize } from './summary';

const DOT: Record<CellFilter, string> = {
  failing: 'bg-status-failure',
  running: 'bg-status-started',
  behind: 'bg-badge-behind',
  diverged: 'bg-badge-diverged',
};

export function BoardSummary({
  model,
  filter,
  onFilter,
}: {
  model: BoardModel;
  filter: CellFilter | null;
  onFilter: (filter: CellFilter | null) => void;
}): React.JSX.Element {
  const counts = summarize(model);
  return (
    <div
      role="group"
      aria-label="Filter cells"
      className="flex flex-wrap gap-1.5"
    >
      {FILTERS.map((f) => (
        <ToggleButton
          key={f}
          pressed={filter === f}
          className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5"
          onClick={() => {
            onFilter(filter === f ? null : f);
          }}
        >
          <span aria-hidden className={cn('size-2 rounded-full', DOT[f])} />
          {counts[f]} {f}
        </ToggleButton>
      ))}
    </div>
  );
}

export function BudgetDisplay({
  model,
}: {
  model: BoardModel;
}): React.JSX.Element | null {
  const budgets = Object.entries(model.budgets).flatMap(([id, b]) =>
    b ? [{ id, ...b }] : [],
  );
  if (budgets.length === 0) return null;
  return (
    <div className="flex gap-3 text-xs text-muted-foreground">
      {budgets.map((b) => (
        <span
          key={b.id}
          title={`Resets ${new Date(b.reset * 1000).toLocaleTimeString()}`}
          className={cn(
            b.status === 'low' && 'font-semibold text-status-failure',
          )}
        >
          GitHub {b.id}: {b.remaining.toLocaleString()} of{' '}
          {b.limit.toLocaleString()} left
        </span>
      ))}
    </div>
  );
}
