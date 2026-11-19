/**
 * The hidden tab's ramps (spec §3.L, Decision 113): while the tab is
 * hidden, each row polls ever more slowly. Its ramp starts from the row's
 * own interval when it is first derived hidden (its fastest root query's
 * cadence, without a boost) and steps on when every root query the row
 * needs has completed a fetch since the step began, as a boost's steps do
 * (`completions.ts`), so a row's interval changes only when one of its
 * polls completes. Every query the row observes then polls at the slower
 * of its own interval and the row's hidden one. The model clears the
 * ramps whenever the tab hides or shows, drops them on `destroy` and for
 * rows it no longer has. Pure but for the cache reader `rootCompletions`.
 *
 * @module
 */
import type { QueryClient } from '@tanstack/query-core';

import {
  hiddenFreshness,
  hiddenInterval,
  type HiddenRamp,
} from '@/query/intervals';

import { type Completions, polledSince, rootCompletions } from './completions';
import type { Need } from './need';
import type { RowEntry } from './rowDerive';

/** One row's ramp. */
interface Ramp {
  /** The row's own interval when its ramp started (ms). */
  start: number;
  /** How many of its hidden polls have completed. */
  polls: number;
  /** When its current step began (ms). */
  stepStartedAt: number;
  /** The row's root queries' completions when the step began. */
  baseline: Completions;
}

export interface HiddenRamps {
  /**
   * `entry` (row `rowId`, derived hidden at `at`) with every need polling
   * at the slower of its own interval and the row's hidden one under
   * `ramp`. The row's ramp starts at its first call, from its fastest root
   * query's interval, and steps on once every root query has completed a
   * fetch since its step began. A row with no polling root query is left
   * as it is.
   */
  hide(
    rowId: string,
    entry: RowEntry,
    client: QueryClient,
    at: number,
    ramp: HiddenRamp,
  ): RowEntry;
  /** Drop every ramp but those of `rowIds`. */
  keep(rowIds: ReadonlySet<string>): void;
  clear(): void;
}

/** The fastest polling interval among `needs`' root queries, if any. */
const ownInterval = (needs: readonly Need[]): number | undefined => {
  const intervals = needs.flatMap(({ root, freshness }) =>
    root && freshness.refetchInterval !== false
      ? [freshness.refetchInterval]
      : [],
  );
  return intervals.length > 0 ? Math.min(...intervals) : undefined;
};

export function createHiddenRamps(): HiddenRamps {
  const ramps = new Map<string, Ramp>();
  /** `rowId`'s ramp, started or stepped on as its completions say. */
  const rampOf = (
    rowId: string,
    own: number,
    completions: Completions,
    at: number,
    ramp: HiddenRamp,
  ): Ramp => {
    const known = ramps.get(rowId);
    const next: Ramp =
      known === undefined
        ? { start: own, polls: 0, stepStartedAt: at, baseline: completions }
        : // At the period, a row stays there: no more steps to take.
          hiddenInterval(known.start, known.polls, ramp) < ramp.periodMs &&
            polledSince(completions, known.baseline, known.stepStartedAt)
          ? {
              ...known,
              polls: known.polls + 1,
              stepStartedAt: at,
              baseline: completions,
            }
          : known;
    ramps.set(rowId, next);
    return next;
  };
  return {
    hide(rowId, entry, client, at, ramp) {
      const own = ownInterval(entry.needs);
      if (own === undefined) return entry;
      const { start, polls } = rampOf(
        rowId,
        own,
        rootCompletions(client, entry.needs),
        at,
        ramp,
      );
      const interval = hiddenInterval(start, polls, ramp);
      return {
        ...entry,
        needs: entry.needs.map((need) => ({
          ...need,
          freshness: hiddenFreshness(need.freshness, interval),
        })),
      };
    },
    keep(rowIds) {
      for (const rowId of ramps.keys())
        if (!rowIds.has(rowId)) ramps.delete(rowId);
    },
    clear() {
      ramps.clear();
    },
  };
}
