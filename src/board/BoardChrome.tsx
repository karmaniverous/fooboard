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

import { type BadgeKind, type CellFilter, summarize } from './summary';

/** Summary-status chips get a dot in the status's colour; behind and
 * diverged, whose colours may repeat status colours, get a white circle
 * ringed in their colour. */
const BADGE_DOT: Record<BadgeKind, string> = {
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
  const chips = summarize(model);
  return (
    <ToggleGroup
      type="single"
      aria-label="Filter cells"
      className="flex-wrap gap-1.5"
      value={filter ?? ''}
      onValueChange={(v) => {
        onFilter(chips.find((c) => c.id === v)?.id ?? null);
      }}
    >
      {chips.map(({ id, name, color, badge, count }) => {
        const label = `${String(count)} ${name}`;
        const chip = (
          <ToggleGroupItem
            key={id}
            value={id}
            aria-label={label}
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5"
          >
            <span
              aria-hidden
              className={cn(
                'rounded-full',
                badge ? BADGE_DOT[badge] : 'size-2',
              )}
              style={color ? { backgroundColor: color } : undefined}
            />
            {count}
            {words && <span>{name}</span>}
          </ToggleGroupItem>
        );
        // Without its word, a chip says what it counts on hover (C-14a).
        return words ? (
          chip
        ) : (
          <WithTooltip key={id} label={label}>
            {chip}
          </WithTooltip>
        );
      })}
    </ToggleGroup>
  );
}

/** Battery segments, and the colour for each number of lit segments. The
 * battery shows the share left in quarters, its own scale on purpose: the
 * budget's `low` status (10% left) and polling back-off (50% used) are
 * engine thresholds, not what a glance at the board should convey. */
const SEGMENTS = 4;
const SEGMENT_COLOR = [
  'text-red-600',
  'text-red-600',
  'text-orange-500',
  'text-yellow-500',
  'text-green-600',
] as const;

/** Each GitHub token's remaining request budget (C-16) as an upright
 * battery of four segments: the fill is what is left, so empty is bad.
 * Outline and fill share one colour: green (4 lit), yellow (3), orange
 * (2), red (1 or empty). Every token the board uses has a battery from the
 * start; one not read yet is grey and empty. The credential's label, exact
 * numbers and the reset time are in the tooltip and the accessible name. */
export function BudgetMeter({
  model,
  labels = {},
}: {
  model: BoardModel;
  /** Credential labels by id (the id is shown if a label is missing). */
  labels?: Readonly<Record<string, string>>;
}): React.JSX.Element | null {
  const budgets = Object.entries(model.budgets);
  if (budgets.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      {budgets.map(([id, b]) => {
        const name = `GitHub ${labels[id] ?? id}`;
        const share =
          b && b.limit > 0
            ? Math.max(0, Math.min(1, b.remaining / b.limit))
            : 0;
        const lit = b ? Math.ceil(share * SEGMENTS - 1e-9) : 0;
        const label = b
          ? `${name}: ${b.remaining.toLocaleString()} of ${b.limit.toLocaleString()} requests left, resets ${new Date(b.reset * 1000).toLocaleTimeString()}`
          : `${name}: requests left not known yet`;
        return (
          <WithTooltip key={id} label={label}>
            <span
              tabIndex={0}
              aria-label={label}
              // A meter needs a value: until the budget is read, the
              // battery is an image whose name says so.
              {...(b
                ? {
                    role: 'meter',
                    'aria-valuemin': 0,
                    'aria-valuemax': b.limit,
                    'aria-valuenow': b.remaining,
                  }
                : { role: 'img' })}
              className={cn(
                'flex flex-col items-center',
                b
                  ? (SEGMENT_COLOR[lit] ?? SEGMENT_COLOR[0])
                  : 'text-muted-foreground',
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
