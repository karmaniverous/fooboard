/**
 * Tests for reloading a saved dashboard (spec.md §3.4, Decisions 46 and
 * 47): the page waits for the persisted cache, then shows the last known
 * board at once, before any request answers, with the refreshing mark on
 * whatever is older than its poll interval.
 *
 * @module
 */
import { act, render, screen } from '@testing-library/react';
import { Suspense } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { measureBoard } from '@/demo/scenarios/measure';
import { appQueryEnv } from '@/engine/appEnv';
import { githubKey } from '@/query/keys';
import { DEMO_TOKEN, seedDemoRepo } from '@/test/githubCache';
import { storedKeys } from '@/test/persisted';
import { dashboardPageAt } from '@/test/renderDashboardPage';
import { browser, openTab } from '@/test/tabs';
import { WAIT } from '@/test/timeouts';

const REPO = measureBoard.rows.flatMap((r) =>
  r.type === 'github' ? [r.repo] : [],
)[0];

describe('reloading a dashboard', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('shows the cached board at once, marking what is overdue', async () => {
    const shared = await readBefore();

    // The reload, an hour on; nothing GitHub is asked answers.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 60 * 60 * 1000);
    await reload(shared);
    expect(
      screen.getAllByRole('link', { name: /^(Passed|Failed|Running)/ }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByTestId('refreshing-mark').length).toBeGreaterThan(0);
  });

  it('asks GitHub nothing it has kept when reloaded within the poll interval', async () => {
    const shared = await readBefore();
    await reload(shared);
    expect(
      screen.getAllByRole('link', { name: /^(Passed|Failed|Running)/ }).length,
    ).toBeGreaterThan(0);
    await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
    // Only the reads nothing was kept for (other repos, compares) go out.
    const urls = vi
      .mocked(fetch)
      .mock.calls.map(([url]) =>
        url instanceof Request ? url.url : url.toString(),
      );
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.filter((url) => url.includes(`/${REPO}/actions/`))).toEqual([]);
  });
});

/** One tab read the board and the cache was written; returns the browser. */
async function readBefore() {
  if (!REPO) throw new Error('the demo has no GitHub row');
  const shared = browser();
  const before = openTab(shared);
  before.config.saveDashboard(measureBoard);
  before.credentials.set(
    DEMO_TOKEN,
    { kind: 'github', token: 'ghp_kept' },
    true,
  );
  const env = appQueryEnv(before);
  await env.restored;
  // Read with the remembered token: the queries are noted as read with
  // it, then the answers land again, so the next write keeps them.
  await seedDemoRepo(env.client, REPO);
  const fingerprint = env.providers.fingerprint(DEMO_TOKEN);
  if (fingerprint === undefined) throw new Error('no token entered');
  for (const query of env.client.getQueryCache().getAll())
    env.readWith.note(query, fingerprint);
  await seedDemoRepo(env.client, REPO);
  const runs = JSON.stringify(
    githubKey(DEMO_TOKEN, { call: 'runs', repo: REPO, page: 1 }),
  );
  await vi.waitFor(() => {
    expect(
      storedKeys(shared.idb.entries).map((k) => JSON.stringify(k)),
    ).toContain(runs);
  }, WAIT);
  return shared;
}

/** Open a new tab on `shared`'s board, GitHub never answering. The
 * page renders before the cache is restored, as on a real reload, and
 * reads nothing while it waits. */
async function reload(shared: ReturnType<typeof browser>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>(() => undefined)),
  );
  let restore = (): void => undefined;
  const held = new Promise<void>((resolve) => {
    restore = resolve;
  });
  const after = openTab({
    ...shared,
    idb: {
      ...shared.idb,
      getItem: async (key) => {
        await held;
        return shared.idb.getItem(key);
      },
    },
  });
  await act(async () => {
    render(
      <Suspense fallback={<p>Loading…</p>}>
        {dashboardPageAt(after, measureBoard.id)}
      </Suspense>,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(screen.getByText('Loading…')).toBeInTheDocument();
  expect(fetch).not.toHaveBeenCalled();
  await act(async () => {
    restore();
    await appQueryEnv(after).restored;
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  expect(screen.queryByText('Loading…')).toBeNull();
}
