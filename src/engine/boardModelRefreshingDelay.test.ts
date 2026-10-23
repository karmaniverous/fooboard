/**
 * Tests for the board model's refreshing delay (spec.md §3.1, Decision
 * 47): a fetch marks the row it feeds only once it has run longer than
 * `REFRESHING_DELAY_MS`, so a quick poll never flashes the dot, and from
 * then until it lands; overdue data is marked at once; and the delay's
 * timer is cleared when the fetch lands and when the model is destroyed.
 *
 * @module
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { demoDashboard } from '@/demo/board';
import type { QueryEnv } from '@/query/client';
import { githubKey } from '@/query/keys';
import { demoEnv, OVERDUE_MS, settle } from '@/test/boardModel';
import { DEMO_TOKEN, demoGithubRow } from '@/test/githubCache';
import { markFetching, markLanded } from '@/test/queryState';

import { createBoardModel } from './boardModel';
import { REFRESHING_DELAY_MS } from './refreshing';
import { type BoardModel, cellKey } from './types';

const row = demoGithubRow(demoDashboard.rows[0]?.id ?? '');
const runs = githubKey(DEMO_TOKEN, { call: 'runs', repo: row.repo, page: 1 });

/** Whether each of the row's cells is marked refreshing. */
const marks = (model: BoardModel) =>
  demoDashboard.stages.map(
    (s) => model.cells[cellKey(row.id, s.id)]?.refreshing === true,
  );

/** The demo board, read once through `env`; the clock and timeouts are
 * fake from then on. */
async function readBoard(env: QueryEnv, now = () => Date.now()) {
  const board = createBoardModel({ dashboard: demoDashboard, env, now });
  await settle(env, board);
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'Date'],
    shouldClearNativeTimers: true,
  });
  return board;
}

/** Let a scheduled re-derive run. */
const rederived = () => Promise.resolve();

describe('board model refreshing delay', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('never marks a row for a poll that lands within the delay', async () => {
    const env = demoEnv();
    const board = await readBoard(env);
    const seen: boolean[][] = [];
    board.subscribe(() => seen.push(marks(board.getModel())));
    await env.client.refetchQueries({ queryKey: runs });
    await rederived();
    const published = seen.length;
    expect(published).toBeGreaterThan(0);
    expect(seen.flat().some(Boolean)).toBe(false);
    await vi.advanceTimersByTimeAsync(REFRESHING_DELAY_MS * 2);
    expect(seen).toHaveLength(published);
    board.destroy();
  });

  it('marks a row once its fetch has run past the delay, until it lands', async () => {
    const env = demoEnv();
    const board = await readBoard(env);
    markFetching(env.client, runs);
    await rederived();
    expect(marks(board.getModel()).some(Boolean)).toBe(false);
    await vi.advanceTimersByTimeAsync(REFRESHING_DELAY_MS);
    expect(marks(board.getModel()).some(Boolean)).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(marks(board.getModel()).every(Boolean)).toBe(true);
    await vi.advanceTimersByTimeAsync(REFRESHING_DELAY_MS);
    expect(marks(board.getModel()).every(Boolean)).toBe(true);
    markLanded(env.client, runs, Date.now());
    await rederived();
    expect(marks(board.getModel()).some(Boolean)).toBe(false);
    board.destroy();
  });

  it('marks overdue data at once, while its fetch is within the delay', async () => {
    const env = demoEnv();
    let age = 0;
    const board = await readBoard(env, () => Date.now() + age);
    age = OVERDUE_MS;
    markFetching(env.client, runs);
    await rederived();
    expect(marks(board.getModel()).every(Boolean)).toBe(true);
    board.destroy();
  });

  it('leaves no timer and no re-derive when destroyed mid-delay', async () => {
    const env = demoEnv();
    // Unobserved queries are kept, so destroying the model schedules no
    // garbage collection to count among the timers left.
    env.client.setDefaultOptions({
      queries: { ...env.client.getDefaultOptions().queries, gcTime: Infinity },
    });
    const board = await readBoard(env);
    markFetching(env.client, runs);
    await rederived();
    await vi.advanceTimersByTimeAsync(REFRESHING_DELAY_MS / 2);
    expect(marks(board.getModel()).some(Boolean)).toBe(false);
    const before = board.getModel();
    board.destroy();
    // The delay's timer goes with the observers' own.
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(REFRESHING_DELAY_MS);
    expect(board.getModel()).toBe(before);
  });
});
