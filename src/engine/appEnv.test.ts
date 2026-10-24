/**
 * Tests for the app's persisted query environment (spec.md §3.1, §3.4,
 * Decisions 27 and 38): a session-only credential's queries are never
 * persisted, and unticking *Remember* removes them; a changed secret
 * removes the old data from memory and the cache; deleting a dashboard
 * removes its credentials' queries; editor lookups and secrets are never
 * at rest; and a budget read with an old secret that lands after the
 * secret changed doesn't bring the old battery or back-off back
 * (fooboard#24).
 *
 * @module
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteWithSecrets } from '@/credentials/credentialOps';
import { demoDashboard } from '@/demo/board';
import { isOverPollingShare } from '@/lib/github';
import { PERSIST_THROTTLE_MS } from '@/persist/persistence';
import { githubKey } from '@/query/keys';
import { fetched } from '@/test/fakeReaders';
import {
  runsKey,
  seedRuns,
  storedCredentials,
  storedKeys,
} from '@/test/persisted';
import { browser, openTab } from '@/test/tabs';

import { appQueryEnv } from './appEnv';

const github = (token: string) => ({ kind: 'github' as const, token });

/** A tab of a fresh browser, its environment restored and persisting. */
async function persistingTab() {
  const shared = browser();
  const stores = openTab(shared);
  const env = appQueryEnv(stores);
  await env.restored;
  await vi.advanceTimersByTimeAsync(0);
  /** Let the throttled write land. */
  const written = () => vi.advanceTimersByTimeAsync(PERSIST_THROTTLE_MS);
  return { shared, stores, env, written };
}

describe('appQueryEnv persistence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('never persists a session-only credential’s queries, and unticking Remember removes them', async () => {
    const { shared, stores, env, written } = await persistingTab();
    stores.credentials.set('kept', github('a'), true);
    stores.credentials.set('session', github('b'), false);
    seedRuns(env, 'kept', 'session');
    await written();
    expect(storedCredentials(shared.idb.entries)).toEqual(['kept']);

    stores.credentials.set('kept', github('a'), false);
    expect(env.client.getQueryData(runsKey('kept'))).toBeUndefined();
    await written();
    expect(storedCredentials(shared.idb.entries)).toEqual([]);
  });

  it('keeps an unobserved query a day, not five minutes', async () => {
    const { env } = await persistingTab();
    seedRuns(env, 'gh');
    await vi.advanceTimersByTimeAsync(6 * 60 * 1000);
    expect(env.client.getQueryData(runsKey('gh'))).toBeDefined();
  });

  it('keeps data through ticking Remember and entering the same secret', async () => {
    const { stores, env } = await persistingTab();
    stores.credentials.set('gh', github('a'), false);
    seedRuns(env, 'gh');
    stores.credentials.set('gh', github('a'), true);
    stores.credentials.set('gh', github('a'), true);
    expect(env.client.getQueryData(runsKey('gh'))).toBeDefined();
  });

  it('removes data read with a replaced secret from memory and the cache', async () => {
    const { shared, stores, env, written } = await persistingTab();
    stores.credentials.set('gh', github('one'), true);
    stores.credentials.set('other', github('o'), true);
    seedRuns(env, 'gh', 'other');
    await written();
    stores.credentials.set('gh', github('two'), true);
    expect(env.client.getQueryData(runsKey('gh'))).toBeUndefined();
    await written();
    expect(storedCredentials(shared.idb.entries)).toEqual(['other']);
  });

  it('removes the queries of every credential a deleted dashboard held', async () => {
    const { shared, stores, env, written } = await persistingTab();
    const dashboard = {
      ...demoDashboard,
      credentials: [
        { id: 'gh', kind: 'github' as const, label: 'token' },
        { id: 'gone', kind: 'github' as const, label: 'no secret here' },
      ],
    };
    stores.credentials.set('gh', github('a'), true);
    stores.credentials.set('other', github('o'), true);
    seedRuns(env, 'gh', 'gone', 'other');
    deleteWithSecrets(stores.credentials, () => undefined, dashboard);
    expect(env.client.getQueryData(runsKey('gone'))).toBeUndefined();
    await written();
    expect(storedCredentials(shared.idb.entries)).toEqual(['other']);
  });

  it('keeps editor lookups and secrets out of the cache', async () => {
    const { shared, stores, env, written } = await persistingTab();
    stores.credentials.set('gh', github('ghp_never_at_rest'), true);
    seedRuns(env, 'gh');
    env.client.setQueryData(
      githubKey('gh', { call: 'repos', page: 1 }),
      fetched([]),
    );
    await written();
    expect(storedKeys(shared.idb.entries)).toEqual([runsKey('gh')]);
    expect(
      [...shared.idb.entries.values()].join().includes('ghp_never_at_rest'),
    ).toBe(false);
  });

  it('ignores a budget from a request made with the old secret that lands after it changed (#24)', async () => {
    let answer: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            answer = resolve;
          }),
      ),
    );
    const { stores, env } = await persistingTab();
    stores.credentials.set('gh', github('old'), true);
    void env.client.query({ queryKey: runsKey('gh') }).catch(() => undefined);
    await vi.advanceTimersByTimeAsync(0);

    stores.credentials.set('gh', github('new'), true);
    answer(
      new Response(JSON.stringify({ total_count: 0, workflow_runs: [] }), {
        headers: {
          'x-ratelimit-limit': '5000',
          'x-ratelimit-remaining': '100',
          'x-ratelimit-reset': '1',
          'x-ratelimit-used': '4900',
        },
      }),
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledOnce();
    // The battery stays grey, and no back-off applies to the new token.
    expect(env.budgets.get('gh')).toBeUndefined();
    expect(isOverPollingShare(env.budgets.get('gh'))).toBe(false);
  });
});
