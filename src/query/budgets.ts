/**
 * The budget store (spec.md §3.1, Decision 6): each GitHub credential's
 * latest rate-limit budget, fed by every response's headers, outside any
 * board. There is no `rate_limit` request: a battery stays grey until its
 * token's first response, and goes grey again when the token is replaced
 * or forgotten (its budget is no longer the credential's). Subscribers
 * hear every change.
 *
 * Readings only move forward (spec 0.2.0 §3.J *Batteries and the first
 * poll*, Decision 109): responses land out of order, so the last one
 * received isn't the latest. GitHub's own counters decide, since the
 * browser can't read the `Date` header under CORS: a later `reset` is a
 * new window and replaces the reading; the same `reset` replaces it only
 * with fewer requests left; an earlier `reset` is ignored.
 *
 * @module
 */
import type { RateLimitBudget } from '@/lib/github';

export interface BudgetStore {
  get(credentialId: string): RateLimitBudget | undefined;
  /** Record what a response reported, if it is newer than the reading
   * held (`supersedes`). */
  note(credentialId: string, budget: RateLimitBudget): void;
  /** Drop a credential's budget: its secret changed or went. */
  forget(credentialId: string): void;
  subscribe(listener: () => void): () => void;
}

/** Whether `next` should replace `current` (Decision 109): a later
 * window, or the same window with fewer requests left. */
function supersedes(
  next: RateLimitBudget,
  current: RateLimitBudget | undefined,
): boolean {
  if (!current) return true;
  if (next.reset !== current.reset) return next.reset > current.reset;
  return next.remaining < current.remaining;
}

export function createBudgetStore(): BudgetStore {
  const budgets = new Map<string, RateLimitBudget>();
  const listeners = new Set<() => void>();
  const changed = (): void => {
    for (const listener of listeners) listener();
  };
  return {
    get: (id) => budgets.get(id),
    note(id, budget) {
      if (!supersedes(budget, budgets.get(id))) return;
      budgets.set(id, budget);
      changed();
    },
    forget(id) {
      if (budgets.delete(id)) changed();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
