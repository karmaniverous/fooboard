/**
 * Tests for the board model's *refreshing* mark (spec.md §3.1, Decision
 * 46): a board reopened over fresh cached data shows it at once,
 * unmarked; over data older than its poll interval (each row's own),
 * marked; and a poll in flight marks the rows it feeds until it lands.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { demoDashboard } from '@/demo/board';
import { EMPTY_STATES } from '@/domain/derivation';
import {
  ACTIVE_INTERVAL_MS,
  BUDGET_BACKOFF,
  IDLE_INTERVAL_MS,
} from '@/query/intervals';
import { githubKey } from '@/query/keys';
import { demoEnv, settle } from '@/test/boardModel';
import { DEMO_TOKEN } from '@/test/githubCache';

import { createBoardModel } from './boardModel';
import { type BoardModel, cellKey } from './types';

/** Longer than any root query's poll interval. */
const OVERDUE_MS = IDLE_INTERVAL_MS * BUDGET_BACKOFF + 1;

/** The cells showing data: not a missing credential or a failed read. */
const withData = (model: BoardModel) => {
  const noData: string[] = [EMPTY_STATES.needsCredential, EMPTY_STATES.error];
  return Object.values(model.cells).filter(
    (c) =>
      c?.derivation.kind !== 'empty' || !noData.includes(c.derivation.state),
  );
};
const anyRefreshing = (model: BoardModel) =>
  Object.values(model.cells).some((c) => c?.refreshing);

/** A demo board read once, then closed, over the env it read into. */
async function readOnce() {
  const env = demoEnv();
  const first = createBoardModel({ dashboard: demoDashboard, env });
  const filled = await settle(env, first);
  first.destroy();
  return { env, filled };
}

describe('board model refreshing', () => {
  it('shows fresh cached data at once, unmarked, when a board reopens', async () => {
    const { env, filled } = await readOnce();
    const later = createBoardModel({ dashboard: demoDashboard, env });
    const warm = later.getModel();
    expect(Object.keys(warm.cells)).toEqual(Object.keys(filled.cells));
    expect(withData(warm).length).toBeGreaterThan(0);
    expect(anyRefreshing(warm)).toBe(false);
    later.destroy();
  });

  it('marks data older than its poll interval', async () => {
    const { env } = await readOnce();
    const later = createBoardModel({
      dashboard: demoDashboard,
      env,
      now: () => Date.now() + OVERDUE_MS,
    });
    const cells = withData(later.getModel());
    expect(cells.length).toBeGreaterThan(0);
    expect(cells.every((c) => c?.refreshing)).toBe(true);
    later.destroy();
  });

  it('measures age against each row’s own poll interval', async () => {
    const { env } = await readOnce();
    // Past the in-progress interval, within the idle one.
    const later = createBoardModel({
      dashboard: demoDashboard,
      env,
      now: () => Date.now() + ACTIVE_INTERVAL_MS * BUDGET_BACKOFF + 1,
    });
    const model = later.getModel();
    const rows = demoDashboard.rows.map((row) => {
      const cells = demoDashboard.stages.flatMap(
        (s) => model.cells[cellKey(row.id, s.id)] ?? [],
      );
      return {
        active: cells.some((c) => c.active),
        refreshing: cells.some((c) => c.refreshing),
      };
    });
    expect(rows.some((r) => r.active)).toBe(true);
    expect(rows.some((r) => !r.active)).toBe(true);
    for (const r of rows) expect(r.refreshing).toBe(r.active);
    later.destroy();
  });

  it('marks the rows a poll feeds while it is in flight', async () => {
    const env = demoEnv();
    const board = createBoardModel({ dashboard: demoDashboard, env });
    await settle(env, board);
    const [row] = demoDashboard.rows;
    if (row.type !== 'github') throw new Error('the first row is not GitHub');
    const marked = (model: BoardModel) =>
      demoDashboard.stages.map(
        (s) => model.cells[cellKey(row.id, s.id)]?.refreshing === true,
      );
    expect(marked(board.getModel()).some(Boolean)).toBe(false);

    const polled = env.client.refetchQueries({
      queryKey: githubKey(DEMO_TOKEN, {
        call: 'runs',
        repo: row.repo,
        page: 1,
      }),
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(marked(board.getModel()).every(Boolean)).toBe(true);
    await polled;
    expect(marked(await settle(env, board)).some(Boolean)).toBe(false);
    board.destroy();
  });
});
