/**
 * Tests for deriving a GitHub row from the cache (spec.md §3.1, Decisions
 * 26 and 37): what it needs before anything lands, provisional cells from
 * the run alone, final cells once jobs land, the cached placement shown
 * refreshing while a newer run's jobs load, the cold-cache window of jobs
 * requests, failures of the runs and jobs reads, renamed repos, paging,
 * polling cadence, and the whole row refreshing while its runs are
 * fetching or overdue, not while they are fresh (Decision 46).
 *
 * @module
 */
import { QueryClient } from '@tanstack/query-core';
import { describe, expect, it } from 'vitest';

import {
  ACTIVE_INTERVAL_MS,
  BUDGET_BACKOFF,
  IDLE_INTERVAL_MS,
  SETTLED,
} from '@/query/intervals';
import { githubKey } from '@/query/keys';
import {
  DEMO_TOKEN,
  demoContext,
  demoGithubRow,
  demoJobs,
  demoRuns,
  jobsRequest,
  keyOf,
  runsKey,
  seedDemoRepo,
  seedJobs,
  seedRuns,
} from '@/test/githubCache';
import { landedAt, markFetching } from '@/test/queryState';

import { COLD_CANDIDATES_PER_STAGE, deriveGithubRow } from './githubRow';
import type { Need } from './need';

const REPO = 'acme/api-core';
const row = demoGithubRow('api-core');
/** The jobs needs, with the run each one reads. */
const jobsNeeds = (needs: Need[]) =>
  needs.flatMap((need) =>
    need.key[0] === 'github' && need.key[2].call === 'jobs'
      ? [{ need, runId: need.key[2].runId }]
      : [],
  );

describe('deriveGithubRow', () => {
  it('shows nothing and needs the first runs page before anything lands', () => {
    const client = new QueryClient();
    const out = deriveGithubRow(demoContext(client, REPO), row);
    expect(out.cells).toEqual({});
    expect(out.needs.map(keyOf)).toEqual([runsKey(REPO)]);
    expect(out.needs[0]?.freshness.refetchInterval).toBe(IDLE_INTERVAL_MS);
  });

  it('shows provisional cells from the runs alone, not counted as final', async () => {
    const client = new QueryClient();
    seedRuns(client, REPO, await demoRuns(REPO));
    const out = deriveGithubRow(demoContext(client, REPO), row);
    const dev = out.cells.dev;
    expect(dev?.provisional).toBeDefined();
    expect(dev?.pending).toBe(true);
    expect(dev?.derivation.kind).toBe('ok');
    // Jobs are asked for, a few runs per cell at most.
    const stages = Object.keys(out.cells).length;
    expect(jobsNeeds(out.needs).length).toBeGreaterThan(0);
    expect(jobsNeeds(out.needs).length).toBeLessThanOrEqual(
      COLD_CANDIDATES_PER_STAGE * Math.max(stages, 1),
    );
  });

  it('gives a provisional Running cell the fast poll', async () => {
    const client = new QueryClient();
    const runs = (await demoRuns(REPO)).map((r) =>
      r.head_branch === 'dev'
        ? { ...r, status: 'waiting', conclusion: null }
        : r,
    );
    seedRuns(client, REPO, runs);
    const out = deriveGithubRow(demoContext(client, REPO), row);
    expect(out.cells.dev?.derivation).toMatchObject({
      status: { summary: { inProgress: true } },
    });
    expect(out.cells.dev?.active).toBe(true);
    expect(out.needs[0]?.freshness.refetchInterval).toBe(ACTIVE_INTERVAL_MS);
  });

  it('derives final cells once every needed run has its jobs', async () => {
    const client = new QueryClient();
    const runs = await seedDemoRepo(client, REPO);
    const out = deriveGithubRow(demoContext(client, REPO), row);
    expect(out.cells.dev).toMatchObject({
      pending: false,
      derivation: { kind: 'ok', status: { icon: 'success' } },
    });
    expect(out.cells.dev?.provisional).toBeUndefined();
    // A completed run's jobs never poll; a running one's poll fast.
    const byRun = new Map(runs.map((r) => [r.id, r]));
    for (const { need, runId } of jobsNeeds(out.needs)) {
      const run = byRun.get(runId);
      expect(need.freshness).toEqual(
        run?.status === 'completed'
          ? SETTLED
          : {
              refetchInterval: ACTIVE_INTERVAL_MS,
              staleTime: ACTIVE_INTERVAL_MS,
            },
      );
      expect(need.version).toBe(run?.status);
    }
  });

  it('reads a re-run attempt’s own jobs, not the earlier attempt’s', async () => {
    const client = new QueryClient();
    const runs = await seedDemoRepo(client, REPO);
    const dev = runs.find((r) => r.head_branch === 'dev');
    if (!dev) throw new Error('no dev run');
    const rerun = { ...dev, run_attempt: (dev.run_attempt ?? 1) + 1 };
    seedRuns(
      client,
      REPO,
      runs.map((r) => (r.id === dev.id ? rerun : r)),
    );
    const out = deriveGithubRow(demoContext(client, REPO), row);
    const attempts = jobsNeeds(out.needs)
      .filter(({ runId }) => runId === dev.id)
      .map(({ need }) => need.key[2]);
    expect(attempts).toContainEqual(jobsRequest(REPO, rerun));
    expect(attempts).not.toContainEqual(jobsRequest(REPO, dev));
    expect(out.cells.dev?.pending).toBe(true);
  });

  it('shows the cached placement, refreshing, while a newer run loads', async () => {
    const client = new QueryClient();
    const runs = await seedDemoRepo(client, REPO);
    const dev = runs.find((r) => r.head_branch === 'dev');
    if (!dev) throw new Error('no dev run');
    const newer = {
      ...dev,
      id: 99_999,
      created_at: new Date(Date.parse(dev.created_at) + 60_000).toISOString(),
    };
    seedRuns(client, REPO, [newer, ...runs]);
    const out = deriveGithubRow(demoContext(client, REPO), row);
    expect(out.cells.dev).toMatchObject({
      refreshing: true,
      pending: true,
      derivation: { kind: 'ok', status: { icon: 'success' } },
    });
    expect(out.needs.map(keyOf)).toContain(
      JSON.stringify(['github', DEMO_TOKEN, jobsRequest(REPO, newer)]),
    );
  });

  it('looks past newer runs whose jobs place nothing', async () => {
    const client = new QueryClient();
    const runs = await seedDemoRepo(client, REPO);
    const dev = runs.find((r) => r.head_branch === 'dev');
    if (!dev) throw new Error('no dev run');
    const template = (await demoJobs(REPO, dev.id)).at(0);
    if (!template) throw new Error('no job');
    const lint = Array.from({ length: 12 }, (_, i) => ({
      ...dev,
      id: 50_000 + i,
      name: 'Lint',
      created_at: new Date(
        Date.parse(dev.created_at) + (i + 1) * 1000,
      ).toISOString(),
    }));
    for (const run of lint)
      seedJobs(client, REPO, run, [
        { ...template, id: run.id, run_id: run.id, name: 'lint' },
      ]);
    seedRuns(client, REPO, [...lint.reverse(), ...runs]);
    const out = deriveGithubRow(demoContext(client, REPO), row);
    expect(out.cells.dev).toMatchObject({
      pending: false,
      derivation: { kind: 'ok', status: { icon: 'success' } },
    });
  });

  it('reads the next runs page only while the window needs it', async () => {
    const client = new QueryClient();
    const runs = await demoRuns(REPO);
    seedRuns(client, REPO, runs, { hasNext: true });
    const ctx = demoContext(client, REPO);
    const wide = {
      ...ctx,
      source: { ...ctx.source, reader: { ...ctx.source.reader, runs: 200 } },
    };
    expect(deriveGithubRow(wide, row).needs.map(keyOf)).toContain(
      runsKey(REPO, 2),
    );
    const narrow = {
      ...ctx,
      source: { ...ctx.source, reader: { ...ctx.source.reader, runs: 100 } },
    };
    expect(deriveGithubRow(narrow, row).needs.map(keyOf)).not.toContain(
      runsKey(REPO, 2),
    );
  });

  it('backs off over budget', async () => {
    const client = new QueryClient();
    await seedDemoRepo(client, REPO);
    const out = deriveGithubRow(
      demoContext(client, REPO, { overBudget: true }),
      row,
    );
    const interval = out.needs[0]?.freshness.refetchInterval;
    expect([
      IDLE_INTERVAL_MS * BUDGET_BACKOFF,
      ACTIVE_INTERVAL_MS * BUDGET_BACKOFF,
    ]).toContain(interval);
  });
});

describe('deriveGithubRow refreshing', () => {
  const runs = githubKey(DEMO_TOKEN, { call: 'runs', repo: REPO, page: 1 });

  /** The row derived `age(interval)` ms after its runs landed, where
   * `interval` is how often the row's runs poll. */
  async function derivedAt(
    age: (interval: number) => number,
    fetching = false,
  ) {
    const client = new QueryClient();
    await seedDemoRepo(client, REPO);
    if (fetching) markFetching(client, runs);
    const landed = landedAt(client, runs);
    const at = (now: number) =>
      deriveGithubRow(demoContext(client, REPO, { now }), row);
    const interval = at(landed).needs[0]?.freshness.refetchInterval;
    if (typeof interval !== 'number') throw new Error('the runs never poll');
    const cells = Object.values(at(landed + age(interval)).cells);
    expect(cells.length).toBeGreaterThan(0);
    return cells.map((c) => c?.refreshing === true);
  }

  it('leaves fresh cached runs unmarked, as on reopening a board', async () => {
    const marks = await derivedAt((interval) => interval);
    expect(marks.some(Boolean)).toBe(false);
  });

  it('marks every cell once the runs are older than their poll interval', async () => {
    const marks = await derivedAt((interval) => interval + 1);
    expect(marks.every(Boolean)).toBe(true);
  });

  it('marks every cell while the runs are fetching, however fresh', async () => {
    const marks = await derivedAt(() => 0, true);
    expect(marks.every(Boolean)).toBe(true);
  });
});
