/**
 * The query environment (spec.md §3.1, Decision 2): one QueryClient for
 * the app, created with the stores and outside any board, so it outlives
 * dashboard edits and credential changes, together with its per-credential
 * limiters, the budget store and the instrumentation hook. The demo
 * builds its own, never persisted. Query defaults follow Decision 29: no
 * retry for 4xx or rate limits, up to two for network errors and 5xx,
 * focus and reconnect refetch what is stale, polling pauses while the tab
 * is hidden. The environment never mounts its client: whoever renders it
 * does (`QueryProvider` mounts it in an effect and unmounts it on
 * cleanup), so an environment a page owns (the demo's) lets go of the
 * focus and online listeners when the page goes, and one React discards
 * (StrictMode's second state initializer) holds none.
 *
 * A budget report counts only while the secret that made it is still the
 * credential's (fooboard#24): a request sent with an old secret that lands
 * after the secret changed can't bring back the old token's battery or its
 * back-off.
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
import { createReadWith, type ReadWith } from './readWith';

/** What providers may report back to the environment. */
export interface ProviderHooks {
  /** A GitHub response reported `budget` for `credentialId`, read
   * with the secret whose fingerprint is `fingerprint`. */
  onBudget(
    credentialId: string,
    budget: RateLimitBudget,
    fingerprint: string | undefined,
  ): void;
}

export interface QueryEnv {
  client: QueryClient;
  providers: QueryProviders;
  limiters: Limiters;
  budgets: BudgetStore;
  /** The secret each query's data was read with (Decision 27). */
  readWith: ReadWith;
  /** Instrument every request from now on (development only). */
  setAround(around: Around | undefined): void;
  /** Remove the queries and the budget of every one of `credentialIds`
   * (a changed or forgotten secret, unticked *Remember*, a removed
   * credential or dashboard), so nothing read with an old secret stays on
   * screen and its back-off isn't applied to the new one (spec.md §3.1). */
  removeCredentials(credentialIds: readonly string[]): void;
}

export function createQueryEnv({
  providers: build,
  now = Date.now,
  timers,
  gcTime,
}: {
  providers: (hooks: ProviderHooks) => QueryProviders;
  now?: () => number;
  timers?: Timers;
  /** How long an unobserved query is kept (the persisted app's 24 h);
   * TanStack's default otherwise. */
  gcTime?: number;
}): QueryEnv {
  const budgets = createBudgetStore();
  const limiters = createLimiters({ now, timers });
  const readWith = createReadWith();
  const providers = build({
    onBudget: (id, b, fingerprint) => {
      if (fingerprint === providers.fingerprint(id)) budgets.note(id, b);
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
          readWith,
        }),
        retry: shouldRetry,
        retryDelay,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
        refetchIntervalInBackground: false,
        ...(gcTime === undefined ? {} : { gcTime }),
      },
    },
  });
  return {
    client,
    providers,
    limiters,
    budgets,
    readWith,
    setAround(next) {
      around = next ?? passThrough;
    },
    removeCredentials(credentialIds) {
      for (const id of credentialIds) {
        for (const provider of ['github', 'amplify'] as const)
          client.removeQueries({ queryKey: credentialPrefix(provider, id) });
        budgets.forget(id);
      }
    },
  };
}
