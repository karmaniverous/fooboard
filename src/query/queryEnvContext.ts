/**
 * The React context carrying the query environment (spec.md §3.1), kept
 * apart from the provider component so fast refresh keeps working.
 *
 * @module
 */
import { createContext, useContext } from 'react';

import type { QueryEnv } from './client';

export const QueryEnvContext = createContext<QueryEnv | undefined>(undefined);

/** The query environment of the nearest `QueryProvider`. */
export function useQueryEnv(): QueryEnv {
  const env = useContext(QueryEnvContext);
  if (!env) throw new Error('useQueryEnv needs a QueryProvider');
  return env;
}
