/**
 * The query environment in React (spec.md §3.1, §3.5): provides the
 * QueryClient to the React bindings and the whole environment (providers,
 * limiters, budgets) to the board and editors. In development builds the
 * TanStack Query Devtools are loaded lazily, so production bundles never
 * contain them.
 *
 * @module
 */
import { QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense } from 'react';

import type { QueryEnv } from './client';
import { QueryEnvContext } from './queryEnvContext';

/** The Devtools, development builds only (loaded on first render). */
const Devtools = import.meta.env.DEV
  ? lazy(async () => ({
      default: (await import('@tanstack/react-query-devtools'))
        .ReactQueryDevtools,
    }))
  : undefined;

export function QueryProvider({
  env,
  children,
}: {
  env: QueryEnv;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <QueryEnvContext value={env}>
      <QueryClientProvider client={env.client}>
        {children}
        {Devtools && import.meta.env.MODE !== 'test' && (
          <Suspense fallback={null}>
            <Devtools />
          </Suspense>
        )}
      </QueryClientProvider>
    </QueryEnvContext>
  );
}
