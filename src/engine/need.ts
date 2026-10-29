/**
 * What a row derivation asks of the query layer (spec.md §3.1): the
 * queries to keep observed, how often each polls, and a version whose
 * change invalidates the query once (a run that completed refetches its
 * jobs one last time; a compare refetches on a new commit).
 *
 * @module
 */
import type { Problem } from '@/domain/problems/problem';
import type { Freshness } from '@/query/intervals';
import type { FooboardQueryKey } from '@/query/keys';

import type { CellView } from './types';

export interface Need {
  key: FooboardQueryKey;
  freshness: Freshness;
  /** When this differs from the version last seen for the key, the
   * query is invalidated (never on first sight). */
  version?: string;
  /** A root query of its row (a GitHub row's runs pages, an Amplify
   * row's app reads): the queries a row's boost polls and steps on
   * (spec 0.2.0 §3.H). */
  root?: boolean;
}

/** One row's derivation from the cache. */
export interface RowDerivation {
  /** By stage id; a stage without data yet is absent (skeleton). */
  cells: Partial<Record<string, CellView>>;
  needs: Need[];
  problems: Problem[];
  /** When the row's root data last landed (ms), if it has any. */
  refreshedAt?: number;
}
