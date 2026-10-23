/**
 * The budget store (spec.md §3.1, Decision 6): each GitHub credential's
 * latest rate-limit budget, fed by every response's headers, outside any
 * board. There is no `rate_limit` request: a battery stays grey until its
 * token's first response, and goes grey again when the token is replaced
 * or forgotten (its budget is no longer the credential's). Subscribers
 * hear every change.
 *
 * @module
 */
import type { RateLimitBudget } from '@/lib/github';

export interface BudgetStore {
  get(credentialId: string): RateLimitBudget | undefined;
  /** Record what a response reported. */
  note(credentialId: string, budget: RateLimitBudget): void;
  /** Drop a credential's budget: its secret changed or went. */
  forget(credentialId: string): void;
  subscribe(listener: () => void): () => void;
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
