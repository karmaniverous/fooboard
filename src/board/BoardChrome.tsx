/**
 * Board chrome above the grid: the summary counts as filter toggles
 * (spec.md C-14a) and each credential's remaining GitHub budget (C-16).
 *
 * @module
 */
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { WithTooltip } from '@/components/ui/tooltip';
import type { BoardModel } from '@/engine';
import { cn } from '@/lib/utils';

import { type CellFilter, FILTERS, summarize } from './summary';

/** Status chips get a filled dot; behind and diverged, whose colours may
 * repeat status colours, get a white circle ringed in their colour. */
const DOT: Record<CellFilter, string> = {
  failing: 'size-2 bg-status-failure',
  running: 'size-2 bg-status-started',
  behind: 'size-2.5 border-2 border-badge-behind bg-white',
  diverged: 'size-2.5 border-2 border-badge-diverged bg-white',
};

export function BoardSummary({
  model,
  filter,
  onFilter,
  words = true,
}: {
  model: BoardModel;
  filter: CellFilter | null;
  onFilter: (filter: CellFilter | null) => void;
  /** Show each chip's word; dropped before the chips would wrap (C-13). */
  words?: boolean;
}): React.JSX.Element {
  const counts = summarize(model);
  return (
    <ToggleGroup
      type="single"
      aria-label="Filter cells"
      className="flex-wrap gap-1.5"
      value={filter ?? ''}
      onValueChange={(v) => {
        onFilter(FILTERS.find((f) => f === v) ?? null);
      }}
    >
      {FILTERS.map((f) => {
        const chip = (
          <ToggleGroupItem
            key={f}
            value={f}
            aria-label={`${String(counts[f])} ${f}`}
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5"
          >
            <span aria-hidden className={cn('rounded-full', DOT[f])} />
            {counts[f]}
            {words && <span>{f}</span>}
          </ToggleGroupItem>
        );
        // Without its word, a chip says what it counts on hover (C-14a).
        return words ? (
          chip
        ) : (
          <WithTooltip key={f} label={`${String(counts[f])} ${f}`}>
            {chip}
          </WithTooltip>
        );
      })}
    </ToggleGroup>
  );
}

/** Battery segments, and the colour for each number of lit segments. */
const SEGMENTS = 4;
const SEGMENT_COLOR = [
  'text-red-600',
  'text-red-600',
  'text-orange-500',
  'text-yellow-500',
  'text-green-600',
] as const;

/** Each credential's remaining GitHub request budget (C-16) as an upright
 * battery of four segments: the fill is what is left, so empty is bad.
 * Outline and fill share one colour: green (4 lit), yellow (3), orange
 * (2), red (1 or empty). Exact numbers and the reset time are in the
 * tooltip and the accessible name. */
export function BudgetMeter({
  model,
}: {
  model: BoardModel;
}): React.JSX.Element | null {
  const budgets = Object.entries(model.budgets).flatMap(([id, b]) =>
    b ? [{ id, ...b }] : [],
  );
  if (budgets.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      {budgets.map((b) => {
        const share =
          b.limit > 0 ? Math.max(0, Math.min(1, b.remaining / b.limit)) : 0;
        const lit = Math.ceil(share * SEGMENTS - 1e-9);
        const label = `GitHub ${b.id}: ${b.remaining.toLocaleString()} of ${b.limit.toLocaleString()} requests left, resets ${new Date(b.reset * 1000).toLocaleTimeString()}`;
        return (
          <WithTooltip key={b.id} label={label}>
            <span
              tabIndex={0}
              role="meter"
              aria-label={label}
              aria-valuemin={0}
              aria-valuemax={b.limit}
              aria-valuenow={b.remaining}
              className={cn(
                'flex flex-col items-center',
                SEGMENT_COLOR[lit] ?? SEGMENT_COLOR[0],
              )}
            >
              {/* Upright battery: nub on top, segments filled from the bottom. */}
              <span
                aria-hidden
                className="h-0.5 w-1.5 rounded-t-sm bg-current"
              />
              <span
                aria-hidden
                className="flex h-5 w-3.5 flex-col-reverse gap-px rounded-[3px] border-[1.5px] border-current p-px"
              >
                {Array.from({ length: SEGMENTS }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'flex-1 rounded-[1px]',
                      i < lit && 'bg-current',
                    )}
                  />
                ))}
              </span>
            </span>
          </WithTooltip>
        );
      })}
    </div>
  );
}
