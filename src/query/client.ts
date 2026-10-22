/**
 * The query environment (spec.md §3.1, Decision 2): one QueryClient for
 * the app, created with the stores and outside any board, so it outlives
 * dashboard edits and credential changes, together with its per-credential
 * limiters, the budget store and the instrumentation hook. The demo
 * builds its own, never persisted. Query defaults follow Decision 29: no
 * retry for 4xx or rate limits, up to two for network errors and 5xx,
 * focus and reconnect refetch what is stale, polling pauses while the tab
 * is hidden.
 *
 * @module
 */
import { QueryClient } from '@tanstack/query-core';

import type { RateLimitBudget } from '@/lib/github';

import { type BudgetStore, createBudgetStore } from './budgets';
import { retryDelay, shouldRetry } from './errors';
import { createQueryFn, type QueryProviders } from './fetchers';
import { type Around, passThrough } from './instrument';
import { credentialPrefix } from './keys';
import type { Timers } from './limiter';
import { createLimiters, type Limiters } from './limiters';

/** What providers may report back to the environment. */
export interface ProviderHooks {
  /** A GitHub response reported `budget` for `credentialId`. */
  onBudget(credentialId: string, budget: RateLimitBudget): void;
}

export interface QueryEnv {
  client: QueryClient;
  providers: QueryProviders;
  limiters: Limiters;
  budgets: BudgetStore;
  /** Instrument every request from now on (development only). */
  setAround(around: Around | undefined): void;
  /** Some secrets may have changed: remove the queries of every one of
   * `credentialIds` whose secret did, so nothing read with the old
   * secret stays on screen (spec.md §3.1). */
  secretsChanged(credentialIds: readonly string[]): void;
}

export function createQueryEnv({
  providers: build,
  now = Date.now,
  timers,
}: {
  providers: (hooks: ProviderHooks) => QueryProviders;
  now?: () => number;
  timers?: Timers;
}): QueryEnv {
  const budgets = createBudgetStore();
  const limiters = createLimiters({ now, timers });
  const providers = build({
    onBudget: (id, b) => {
      budgets.note(id, b);
    },
  });
  let around: Around = passThrough;
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        queryFn: createQueryFn({
          providers,
          limiters,
          now,
          around: () => around,
        }),
        retry: shouldRetry,
        retryDelay,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchIntervalInBackground: false,
      },
    },
  });
  client.mount();
  const seen = new Map<string, string | undefined>();
  return {
    client,
    providers,
    limiters,
    budgets,
    setAround(next) {
      around = next ?? passThrough;
    },
    secretsChanged(credentialIds) {
      for (const id of credentialIds) {
        const fingerprint = providers.fingerprint(id);
        const known = seen.has(id);
        const before = seen.get(id);
        seen.set(id, fingerprint);
        if (!known || before === fingerprint) continue;
        for (const provider of ['github', 'amplify'] as const)
          client.removeQueries({ queryKey: credentialPrefix(provider, id) });
      }
    },
  };
}
