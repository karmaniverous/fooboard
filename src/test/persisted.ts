/**
 * Test helpers for the persisted cache: what the stored copy holds, and
 * a board read (a runs page) seeded into an environment as if it had
 * landed, read with the credential's secret of the moment.
 *
 * @module
 */
import type { QueryKey } from '@tanstack/query-core';
import { z } from 'zod';

import { CACHE_KEY } from '@/persist/persistence';
import type { QueryEnv } from '@/query/client';
import { githubKey } from '@/query/keys';

import { fetched } from './fakeReaders';

/** The part of the stored copy the tests look at. */
const StoredSchema = z.object({
  clientState: z.object({
    queries: z.array(z.object({ queryKey: z.array(z.unknown()) })),
  }),
});

/** The query keys in the stored copy (none when nothing is stored). */
export function storedKeys(entries: Map<string, string>): QueryKey[] {
  const text = entries.get(CACHE_KEY);
  if (text === undefined) return [];
  return StoredSchema.parse(JSON.parse(text)).clientState.queries.map(
    (q) => q.queryKey,
  );
}

/** The credentials whose queries the stored copy holds. */
export const storedCredentials = (entries: Map<string, string>): unknown[] => [
  ...new Set(storedKeys(entries).map((key) => key[1])),
];

/** A runs page of `repo` read with `credentialId`. */
export const runsKey = (credentialId: string, repo = 'acme/api'): QueryKey =>
  githubKey(credentialId, { call: 'runs', repo, page: 1 });

/** Seed a landed runs page for each of `credentialIds`, noted as read
 * with its secret (none noted without one). */
export function seedRuns(
  { client, providers, readWith }: QueryEnv,
  ...credentialIds: string[]
): void {
  for (const id of credentialIds) {
    const queryKey = runsKey(id);
    const fingerprint = providers.fingerprint(id);
    const query = client.getQueryCache().build(client, { queryKey });
    if (fingerprint !== undefined) readWith.note(query, fingerprint);
    client.setQueryData(queryKey, fetched([]));
  }
}
