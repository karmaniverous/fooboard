/**
 * Poll scheduler (spec.md C-16): refreshes each target (one row) every 5 s
 * while it has an active run and every 60 s otherwise; stops while the page
 * is hidden and refreshes everything on return; stretches intervals ×4
 * while a credential is past half its hourly budget. Requests are already
 * serialized per credential by the provider queues. Timers and visibility
 * are injected, so the scheduler is tested with fake timers.
 *
 * @module
 */

/** Poll intervals (spec.md C-16). */
export const ACTIVE_INTERVAL_MS = 5_000;
export const IDLE_INTERVAL_MS = 60_000;
/** Interval multiplier while over budget. */
export const BUDGET_BACKOFF = 4;

/** One thing to poll, typically a row. */
export interface PollTarget {
  id: string;
  refresh(): Promise<void>;
  /** Does the target have a started or queued cell right now? */
  isActive(): boolean;
}

/** Page visibility, injectable (defaults to `document`). */
export interface Visibility {
  isHidden(): boolean;
  onChange(listener: () => void): () => void;
}

/** Timer functions, injectable. */
export interface Timers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface PollScheduler {
  start(): void;
  stop(): void;
}

/** Browser visibility via `document.visibilityState`. */
const documentVisibility: Visibility = {
  isHidden: () => document.visibilityState === 'hidden',
  onChange: (listener) => {
    document.addEventListener('visibilitychange', listener);
    return () => {
      document.removeEventListener('visibilitychange', listener);
    };
  },
};

/** Create a scheduler for `targets`. `overBudget()` reports whether any
 * credential has used more than half its hourly budget. */
export function createPollScheduler({
  targets,
  overBudget,
  timers = globalThis,
  visibility = documentVisibility,
  onError = () => undefined,
}: {
  targets: readonly PollTarget[];
  overBudget: () => boolean;
  /** Called when a refresh throws (providers normally map their own errors
   * to cell states, so this means a bug or an unexpected failure). */
  onError?: (targetId: string, err: unknown) => void;
  timers?: Timers;
  visibility?: Visibility;
}): PollScheduler {
  const handles = new Map<string, unknown>();
  const running = new Set<string>();
  let stopped = true;
  let unsubscribe: (() => void) | undefined;

  const intervalFor = (target: PollTarget): number =>
    (target.isActive() ? ACTIVE_INTERVAL_MS : IDLE_INTERVAL_MS) *
    (overBudget() ? BUDGET_BACKOFF : 1);

  const clear = (id: string): void => {
    if (handles.has(id)) timers.clearTimeout(handles.get(id));
    handles.delete(id);
  };

  const schedule = (target: PollTarget, ms: number): void => {
    clear(target.id);
    handles.set(
      target.id,
      timers.setTimeout(() => {
        void run(target);
      }, ms),
    );
  };

  /** Read live state (not narrowed across the `await` below). */
  const live = (): boolean => !stopped && !visibility.isHidden();

  async function run(target: PollTarget): Promise<void> {
    if (!live() || running.has(target.id)) return;
    running.add(target.id);
    try {
      await target.refresh();
    } catch (err) {
      onError(target.id, err);
    } finally {
      running.delete(target.id);
      // Keep polling after a failure; the next refresh may succeed.
      if (live()) schedule(target, intervalFor(target));
    }
  }

  const runAll = (): void => {
    for (const target of targets) void run(target);
  };

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      unsubscribe = visibility.onChange(() => {
        if (visibility.isHidden()) {
          for (const target of targets) clear(target.id);
        } else {
          runAll();
        }
      });
      runAll();
    },
    stop() {
      stopped = true;
      unsubscribe?.();
      for (const target of targets) clear(target.id);
    },
  };
}
