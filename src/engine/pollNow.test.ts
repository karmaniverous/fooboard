/**
 * Tests for polling a board's roots now (spec 0.2.0 §3.J *Batteries and
 * the first poll*): every root query is read once, in one pass over the
 * cache, a root two rows share once; queries that aren't roots, or that
 * are no need's, aren't read; and a fetch already running isn't restarted.
 * `boardModelFirstPoll.test.ts` pins the behaviour on a whole board.
 *
 * @module
 */
import { QueryClient } from '@tanstack/query-core';
import { describe, expect, it, vi } from 'vitest';

import { SETTLED } from '@/query/intervals';
import { amplifyKey, type FooboardQueryKey, githubKey } from '@/query/keys';

import type { Need } from './need';
import { pollRootsNow } from './pollNow';

const runs = (repo: string) => githubKey('gh', { call: 'runs', repo, page: 1 });
const A = runs('acme/a');
const B = runs('acme/b');
const APP = amplifyKey('aws', {
  call: 'branches',
  region: 'us-east-1',
  appId: 'd1',
});
const JOBS = githubKey('gh', {
  call: 'jobs',
  repo: 'acme/a',
  runId: 1,
  attempt: 1,
  page: 1,
});
const ELSEWHERE = runs('acme/elsewhere');

const need = (key: FooboardQueryKey, root = true): Need => ({
  key,
  freshness: SETTLED,
  root,
});

/** A client holding an answer for each key, counting each one's reads. */
function clientWith(keys: readonly FooboardQueryKey[]) {
  const client = new QueryClient();
  const reads = new Map<string, number>();
  for (const key of keys) {
    const id = JSON.stringify(key);
    client.setQueryData(key, 'cached');
    client
      .getQueryCache()
      .find({ queryKey: key, exact: true })
      ?.setOptions({
        queryKey: key,
        queryFn: () => {
          reads.set(id, (reads.get(id) ?? 0) + 1);
          return 'read';
        },
      });
  }
  return {
    client,
    reads: (key: FooboardQueryKey) => reads.get(JSON.stringify(key)) ?? 0,
  };
}

describe('pollRootsNow', () => {
  it('reads every root once, in one pass, a shared root once', async () => {
    const { client, reads } = clientWith([A, B, APP, JOBS, ELSEWHERE]);
    const refetch = vi.spyOn(client, 'refetchQueries');
    pollRootsNow(client, [
      need(A),
      need(B),
      need(A),
      need(APP),
      need(JOBS, false),
    ]);
    await vi.waitFor(() => {
      expect(reads(APP)).toBe(1);
    });
    expect(refetch).toHaveBeenCalledOnce();
    expect([A, B, APP].map(reads)).toEqual([1, 1, 1]);
    expect([JOBS, ELSEWHERE].map(reads)).toEqual([0, 0]);
  });

  it('reads nothing, and makes no pass, with no roots', () => {
    const { client } = clientWith([A, JOBS]);
    const refetch = vi.spyOn(client, 'refetchQueries');
    pollRootsNow(client, [need(JOBS, false)]);
    pollRootsNow(client, []);
    expect(refetch).not.toHaveBeenCalled();
  });

  it('lets a fetch already running count as the poll', async () => {
    const { client, reads } = clientWith([A]);
    const running = client.refetchQueries({ queryKey: A, exact: true });
    pollRootsNow(client, [need(A)]);
    await running;
    expect(reads(A)).toBe(1);
  });
});
