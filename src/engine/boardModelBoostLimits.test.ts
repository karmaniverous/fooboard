/**
 * Tests for the poll boost's limits and where it reaches (spec 0.2.0
 * §3.H): an in-progress row stays at 5 s (a click still polls it at once);
 * a query two rows share polls at the boosted row's interval; a boost never
 * marks a row refreshing by itself; the root needs of a GitHub and an
 * Amplify row take the boost, backed off four times past half a token's
 * budget, where a dwell's restart is judged at that pace unless another
 * of the row's tokens is under its share; rows the dashboard doesn't
 * have, or a destroyed board, boost nothing.
 *
 * @module
 */
import { QueryClient } from '@tanstack/query-core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { measureBoard, measureScenario } from '@/demo/scenarios/measure';
import {
  MEASURE_AMPLIFY_APPS,
  MEASURE_GITHUB,
} from '@/demo/scenarios/measureBoard';
import type { Dashboard } from '@/domain/config/dashboard';
import {
  ACTIVE_INTERVAL_MS,
  BUDGET_BACKOFF,
  DWELL_BOOST_START_MS,
  IDLE_INTERVAL_MS,
} from '@/query/intervals';
import { amplifyCtx, rowOf, seedRow } from '@/test/amplifyRows';
import { BOOST_ROWS, boostBoard, boostDashboard } from '@/test/boostBoard';
import {
  demoContext,
  demoGithubRow,
  demoRuns,
  seedRuns,
} from '@/test/githubCache';
import { withAliases } from '@/test/simDemo';

import { deriveAmplifyRow } from './amplifyRow';
import { deriveGithubRow } from './githubRow';
import { cellKey } from './types';

const SECOND = 1_000;
/** A budget past half its limit: its token polls four times slower. */
const OVER_SHARE = {
  limit: 5000,
  remaining: 1000,
  reset: 1,
  used: 4000,
  status: 'ok' as const,
};
const at = (...seconds: number[]) => seconds.map((s) => s * SECOND);
/** Long enough for a click's first three polls. */
const THREE_POLLS_MS = 20 * SECOND;

const row = BOOST_ROWS.github;

/** The demo dashboard with only `rows`. */
const boardOf = (rows: Dashboard['rows']): Dashboard => ({
  ...measureBoard,
  rows,
  rowGroups: [],
});

describe('the poll boost, at its limits', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps an in-progress row at 5 s, polling it at once on a click', async () => {
    const active = demoGithubRow('api-core');
    const { board, polls, intervals, done } = await boostBoard(
      boardOf([active]),
    );
    expect(intervals(active)).toEqual([ACTIVE_INTERVAL_MS]);
    const since = Date.now() - SECOND;
    board.attend([active.id], 'click');
    await vi.advanceTimersByTimeAsync(THREE_POLLS_MS);
    expect(intervals(active)).toEqual([ACTIVE_INTERVAL_MS]);
    // Its own 5 s poll was due 4 s in; the click polled at once.
    expect(polls(active, since).slice(0, 3)).toEqual(at(1, 6, 11));
    done();
  });

  it('polls a query two rows share at the boosted row’s interval', async () => {
    const twin = { ...row, id: `${row.id}-twin` };
    const { board, polls, done } = await boostBoard(boardOf([row, twin]));
    const since = Date.now();
    board.attend([twin.id], 'click');
    await vi.advanceTimersByTimeAsync(THREE_POLLS_MS);
    expect(polls(row, since)).toEqual(at(0, 5, 15));
    done();
  });

  it('never marks a row refreshing by itself', async () => {
    const { board, intervals, done } = await boostBoard();
    // Older than a dwell's first interval, within the baseline.
    await vi.advanceTimersByTimeAsync(30 * SECOND);
    board.attend([row.id], 'dwell');
    expect(intervals(row)).toEqual([DWELL_BOOST_START_MS]);
    const cells = boostDashboard.stages.map(
      (s) => board.getModel().cells[cellKey(row.id, s.id)],
    );
    expect(cells.some((c) => c !== undefined)).toBe(true);
    expect(cells.some((c) => c?.refreshing)).toBe(false);
    done();
  });

  it("judges a dwell's restart in real time past half the budget", async () => {
    const { env, board, polls, done } = await boostBoard();
    vi.spyOn(env.budgets, 'get').mockReturnValue(OVER_SHARE);
    board.refresh();
    const since = Date.now();
    board.attend([row.id], 'dwell');
    // Four times slower: the 20 s step began at 40 s, its poll due at
    // 120 s; a restart at 60 s brings it to 100 s.
    await vi.advanceTimersByTimeAsync(60 * SECOND);
    board.attend([row.id], 'dwell');
    await vi.advanceTimersByTimeAsync(50 * SECOND);
    expect(polls(row, since)).toEqual(at(40, 100));
    done();
  });

  it('never postpones the poll of a token under its share, when another of the row’s tokens is past it', async () => {
    const OTHER = 'other-github';
    const [first, ...rest] = measureBoard.stages;
    const split: Dashboard = {
      ...boardOf([row]),
      stages: [{ ...first, settings: { githubToken: OTHER } }, ...rest],
    };
    const { env, board, polls, done } = await boostBoard(
      split,
      withAliases(measureScenario, { [OTHER]: MEASURE_GITHUB }),
    );
    const budget = env.budgets.get.bind(env.budgets);
    vi.spyOn(env.budgets, 'get').mockImplementation((id) =>
      id === MEASURE_GITHUB ? OVER_SHARE : budget(id),
    );
    board.refresh();
    const since = Date.now();
    board.attend([row.id], 'dwell');
    // The row's step lasts until its slower token's poll, at 40 s; its
    // 20 s step then has the faster token's poll due at 60 s. A dwell at
    // 55 s waits for it: restarting at once would bring it to 65 s.
    await vi.advanceTimersByTimeAsync(55 * SECOND);
    board.attend([row.id], 'dwell');
    await vi.advanceTimersByTimeAsync(10 * SECOND);
    expect(polls(row, since, MEASURE_GITHUB)).toEqual(at(40));
    expect(polls(row, since, OTHER)).toEqual(at(10, 20, 30, 60));
    done();
  });

  it('polls nothing for a row the dashboard lacks, or once destroyed', async () => {
    const { env, board, intervals, done } = await boostBoard();
    board.attend(['no-such-row'], 'click');
    expect(env.client.isFetching()).toBe(0);
    expect(intervals(row)).toEqual([IDLE_INTERVAL_MS]);
    board.destroy();
    board.attend([row.id], 'click');
    expect(env.client.isFetching()).toBe(0);
    done();
  });
});

describe('root needs under a boost', () => {
  it("poll a GitHub row's runs at its boost, four times slower past half the budget", async () => {
    const client = new QueryClient();
    const repo = 'acme/mobile-bff';
    seedRuns(client, repo, await demoRuns(repo));
    const github = demoGithubRow('mobile-bff');
    const roots = (overBudget: boolean, boost?: number) =>
      deriveGithubRow(
        demoContext(client, repo, {
          overBudget,
          boostOf: (id) => (id === github.id ? boost : undefined),
        }),
        github,
      ).needs.filter((n) => n.root);
    const interval = (overBudget: boolean, boost?: number) =>
      roots(overBudget, boost).map((n) => n.freshness.refetchInterval);
    expect(interval(false)).toEqual([IDLE_INTERVAL_MS]);
    expect(interval(false, ACTIVE_INTERVAL_MS)).toEqual([ACTIVE_INTERVAL_MS]);
    expect(interval(true, ACTIVE_INTERVAL_MS)).toEqual([
      ACTIVE_INTERVAL_MS * BUDGET_BACKOFF,
    ]);
    expect(interval(true)).toEqual([IDLE_INTERVAL_MS * BUDGET_BACKOFF]);
  });

  it("poll an Amplify row's app reads at its boost, and only them", async () => {
    const client = new QueryClient();
    await seedRow(client, 'partner-portal');
    const amplify = rowOf('partner-portal');
    const needs = (boost?: number) =>
      deriveAmplifyRow(
        {
          ...amplifyCtx(client),
          boostOf: (id) => (id === amplify.id ? boost : undefined),
        },
        amplify,
      ).needs;
    const apps: string[] = MEASURE_AMPLIFY_APPS['partner-portal'].map(
      (a) => a.appId,
    );
    const roots = needs(DWELL_BOOST_START_MS).filter((n) => n.root);
    expect(roots.length).toBeGreaterThan(0);
    for (const need of roots) {
      const [provider, , request] = need.key;
      expect(provider).toBe('amplify');
      expect(apps).toContain('appId' in request ? request.appId : undefined);
      expect(need.freshness.refetchInterval).toBe(DWELL_BOOST_START_MS);
    }
    expect(
      needs()
        .filter((n) => n.root)
        .map((n) => n.freshness.refetchInterval),
    ).toEqual(roots.map(() => IDLE_INTERVAL_MS));
  });
});
