/**
 * The budget store (spec.md §3.1, Decision 6): each GitHub credential's
 * latest rate-limit budget, fed by every response's headers, outside any
 * board. There is no `rate_limit` request: a battery stays grey until its
 * token's first response, and goes grey again when the token is replaced
 * or forgotten (its budget is no longer the credential's). Subscribers
 * hear every change.
 *
 * Readings only move forward and survive a reload (spec 0.2.0 §3.J
 * *Batteries and the first poll*, Decision 109): responses land out of
 * order, so a reading replaces the one held only if it `supersedes` it;
 * and given saved readings, the store starts from them and saves each
 * new one, so the batteries show at once on load. A restored reading
 * whose window has ended (its `reset` has passed) reads as unknown until
 * a response brings a new one. Forgetting a credential removes its saved
 * reading too.
 *
 * @module
 */
import { type RateLimitBudget, supersedes } from '@/lib/github';
import type { SavedBudgets } from '@/storage/savedBudgets';

/** Milliseconds per second: `reset` is in Unix seconds. */
const MS_PER_SECOND = 1000;

export interface BudgetStore {
  get(credentialId: string): RateLimitBudget | undefined;
  /** Record what a response reported, if it is newer than the reading
   * held (`supersedes`). */
  note(credentialId: string, budget: RateLimitBudget): void;
  /** Drop a credential's budget: its secret changed or went. */
  forget(credentialId: string): void;
  subscribe(listener: () => void): () => void;
}

export function createBudgetStore({
  saved,
  now = Date.now,
}: {
  /** Where readings are kept across reloads (none: memory only). */
  saved?: SavedBudgets;
  now?: () => number;
} = {}): BudgetStore {
  const budgets = saved?.load() ?? new Map<string, RateLimitBudget>();
  /** Credentials whose reading came from storage, not a response yet. */
  const restored = new Set(budgets.keys());
  const listeners = new Set<() => void>();
  const changed = (): void => {
    for (const listener of listeners) listener();
  };
  return {
    get(id) {
      const budget = budgets.get(id);
      return budget && restored.has(id) && budget.reset * MS_PER_SECOND <= now()
        ? undefined
        : budget;
    },
    note(id, budget) {
      if (!supersedes(budget, budgets.get(id))) return;
      budgets.set(id, budget);
      restored.delete(id);
      saved?.save(id, budget);
      changed();
    },
    forget(id) {
      restored.delete(id);
      // Another tab may have saved one this tab never held.
      saved?.remove(id);
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
