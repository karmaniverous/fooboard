/**
 * The board's attention store (spec 0.2.0 §3.H, Decisions 79, 85 and
 * 91): which rows the user has shown interest in, and how far each row's
 * boost has stepped. A step ends when every root query the row needs has
 * completed a fetch (with data or an error) since the step began, so a
 * row's interval changes only when a boost starts and when one of its
 * polls completes, never between polls (TanStack restarts a query's
 * interval timer whenever its interval changes). No step begins
 * `BOOST_MAX_MS` or more after the boost started. A dwell restarting a
 * running boost never postpones the row's next poll: when the running
 * step's poll is due sooner than the restarted boost's first interval
 * from now, that poll keeps its time and the restarted boost's first step
 * begins when it completes. For this board in this
 * tab only; the model drops it on `destroy` and for rows it no longer has.
 * Pure but for the cache reader `rootCompletions`.
 *
 * @module
 */
import { hashKey, type QueryClient } from '@tanstack/query-core';

import { BOOST_MAX_MS, boostInterval, type BoostKind } from '@/query/intervals';

import type { Need } from './need';

/** When each root query of a row last completed a fetch (ms; 0: never),
 * by query hash. */
export type Completions = ReadonlyMap<string, number>;

/** One row's boost. */
interface Boost {
  kind: BoostKind;
  /** When the boost started (ms). */
  startedAt: number;
  /** How many of its polls have completed. */
  polls: number;
  /** When its current step began (ms). */
  stepStartedAt: number;
  /** The row's root queries' completions when the step began. */
  baseline: Completions;
  /** A dwell's restart waiting for the running step's poll (due sooner
   * than the restart's first interval) to complete: when it began. */
  restart?: { kind: BoostKind; startedAt: number };
}

export interface Attention {
  /** Start (or restart) `rowId`'s `kind` boost at `at`, its root queries
   * having completed as `completions` say. A dwell doesn't restart a
   * boost already at a shorter interval than a dwell's first, and
   * restarts one whose running poll is due sooner than its first interval
   * from now only once that poll completes; a click always restarts at
   * once. Returns whether it (re)started now. */
  attend(
    rowId: string,
    kind: BoostKind,
    at: number,
    completions: Completions,
  ): boolean;
  /** Step `rowId`'s boost on if every root query in `completions` has
   * completed a fetch since its step began (or begin the restart waiting
   * for that poll); the boost ends after its last step's poll, or at a
   * completed poll `BOOST_MAX_MS` or more after it started (a waiting
   * restart: after its dwell). */
  advance(rowId: string, completions: Completions, at: number): void;
  /** `rowId`'s current boost interval (unmultiplied), if boosted. */
  intervalOf(rowId: string): number | undefined;
  /** Drop every boost but those of `rowIds`. */
  keep(rowIds: ReadonlySet<string>): void;
  clear(): void;
}

/** When `need`'s query last completed a fetch (0: never). */
const completedAt = (client: QueryClient, hash: string): number => {
  const state = client.getQueryCache().get(hash)?.state;
  return state ? Math.max(state.dataUpdatedAt, state.errorUpdatedAt) : 0;
};

/** The completions of the root queries among `needs`. */
export const rootCompletions = (
  client: QueryClient,
  needs: readonly Need[],
): Completions =>
  new Map(
    needs
      .filter((need) => need.root)
      .map((need) => {
        const hash = hashKey(need.key);
        return [hash, completedAt(client, hash)];
      }),
  );

export function createAttention(): Attention {
  const boosts = new Map<string, Boost>();
  const current = (boost: Boost) => boostInterval(boost.kind, boost.polls);
  return {
    attend(rowId, kind, at, completions) {
      const running = boosts.get(rowId);
      const first = boostInterval(kind, 0);
      const interval = running && current(running);
      if (kind === 'dwell' && running && first !== undefined) {
        if ((interval ?? Infinity) < first) return false;
        // Judged in unbacked-off time. Past half a budget both intervals
        // are four times longer: a restart judged so still never postpones
        // the poll, though it may keep one a restart would bring forward.
        if (
          interval !== undefined &&
          running.stepStartedAt + interval - at < first
        ) {
          boosts.set(rowId, { ...running, restart: { kind, startedAt: at } });
          return false;
        }
      }
      boosts.set(rowId, {
        kind,
        startedAt: at,
        polls: 0,
        stepStartedAt: at,
        baseline: completions,
      });
      return true;
    },
    advance(rowId, completions, at) {
      const boost = boosts.get(rowId);
      if (!boost || completions.size === 0) return;
      const done = [...completions].every(
        ([hash, completed]) =>
          completed > (boost.baseline.get(hash) ?? boost.stepStartedAt),
      );
      if (!done) return;
      if (boost.restart) {
        // No step begins `BOOST_MAX_MS` or more after the dwell either.
        if (at - boost.restart.startedAt >= BOOST_MAX_MS) {
          boosts.delete(rowId);
          return;
        }
        boosts.set(rowId, {
          ...boost.restart,
          polls: 0,
          stepStartedAt: at,
          baseline: completions,
        });
        return;
      }
      const polls = boost.polls + 1;
      if (
        at - boost.startedAt >= BOOST_MAX_MS ||
        boostInterval(boost.kind, polls) === undefined
      ) {
        boosts.delete(rowId);
        return;
      }
      boosts.set(rowId, {
        ...boost,
        polls,
        stepStartedAt: at,
        baseline: completions,
      });
    },
    intervalOf(rowId) {
      const boost = boosts.get(rowId);
      return boost && current(boost);
    },
    keep(rowIds) {
      for (const rowId of boosts.keys())
        if (!rowIds.has(rowId)) boosts.delete(rowId);
    },
    clear() {
      boosts.clear();
    },
  };
}
