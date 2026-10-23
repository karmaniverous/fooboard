/**
 * Query state fixtures: when a seeded query's data landed, and a query
 * marked as fetching (a poll in flight) or as landing without running its
 * query function, so derivation tests can read each state from the cache.
 *
 * @module
 */
import type { QueryClient } from '@tanstack/query-core';

const queryOf = (client: QueryClient, key: readonly unknown[]) => {
  const query = client.getQueryCache().find({ queryKey: key, exact: true });
  if (!query) throw new Error(`no query for ${JSON.stringify(key)}`);
  return query;
};

/** When `key`'s data landed (ms). */
export const landedAt = (client: QueryClient, key: readonly unknown[]) =>
  queryOf(client, key).state.dataUpdatedAt;

/** Mark `key`'s query as fetching, as a poll in flight does. */
export function markFetching(
  client: QueryClient,
  key: readonly unknown[],
): void {
  const query = queryOf(client, key);
  query.setState({ ...query.state, fetchStatus: 'fetching' });
}

/** Mark `key`'s fetch as landed at `at` (ms), its data unchanged. */
export function markLanded(
  client: QueryClient,
  key: readonly unknown[],
  at: number,
): void {
  const query = queryOf(client, key);
  query.setState({ ...query.state, fetchStatus: 'idle', dataUpdatedAt: at });
}
