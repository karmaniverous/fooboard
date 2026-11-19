/**
 * Tests for the completion clock (spec 0.2.0 §3.H, spec §3.L): the cache
 * reader takes only root needs, with data or an error; a step has polled
 * only when every root query completed after it began, a query the
 * baseline doesn't know judged against the step's start; a row with no
 * root queries never steps.
 *
 * @module
 */
import { QueryClient } from '@tanstack/query-core';
import { describe, expect, it } from 'vitest';

import { rootFreshness } from '@/query/intervals';
import { githubKey } from '@/query/keys';

import { polledSince, rootCompletions } from './completions';
import type { Need } from './need';

describe('rootCompletions', () => {
  it('reads when each root query last completed, with data or an error', async () => {
    const client = new QueryClient();
    const need = (page: number, root: boolean): Need => ({
      key: githubKey('gh', { call: 'runs', repo: 'acme/api', page }),
      freshness: rootFreshness(false, false),
      ...(root ? { root } : {}),
    });
    const landed = need(1, true);
    const failed = need(2, true);
    client.setQueryData(landed.key, 'runs', { updatedAt: 10 });
    await client
      .query({
        queryKey: failed.key,
        queryFn: () => Promise.reject(new Error('down')),
        retry: false,
      })
      .catch(() => undefined);
    const failedAt = client.getQueryState(failed.key)?.errorUpdatedAt ?? 0;
    expect(failedAt).toBeGreaterThan(0);
    const out = rootCompletions(client, [
      landed,
      failed,
      need(3, true),
      need(4, false),
    ]);
    expect([...out.values()]).toEqual([10, failedAt, 0]);
  });
});

describe('polledSince', () => {
  const at = (a: number, b: number) =>
    new Map([
      ['a', a],
      ['b', b],
    ]);

  it('is true only once every root query has completed since the baseline', () => {
    const baseline = at(5, 5);
    expect(polledSince(at(9, 5), baseline, 5)).toBe(false);
    expect(polledSince(at(9, 9), baseline, 5)).toBe(true);
  });

  it('judges a query the baseline lacks against when the step began', () => {
    const baseline = new Map([['a', 5]]);
    expect(polledSince(at(9, 7), baseline, 8)).toBe(false);
    expect(polledSince(at(9, 9), baseline, 8)).toBe(true);
  });

  it('never steps a row with no root queries', () => {
    expect(polledSince(new Map(), new Map(), 0)).toBe(false);
  });
});
