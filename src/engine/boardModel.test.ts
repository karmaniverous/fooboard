/**
 * Tests for the board model (spec.md §3.1–3.2, Decisions 26, 28, 37): it
 * fills progressively (runs, then jobs, then behind counts), never losing
 * a cell it has shown; a cache update re-derives only the rows it feeds;
 * an edit re-derives from the cache at once, keeping the board filled, and
 * a *requests in flight* change applies to the limiters without reading
 * anything; a destroyed model observes nothing and publishes nothing.
 * Refreshing is tested in boardModelRefreshing.test.ts.
 *
 * @module
 */
import { omit } from 'radash';
import { describe, expect, it } from 'vitest';

import { demoDashboard } from '@/demo/board';
import type { Dashboard } from '@/domain/config/dashboard';
import type { RequestCall } from '@/query/instrument';
import { demoEnv, settle } from '@/test/boardModel';

import { createBoardModel } from './boardModel';
import type { BoardModel } from './types';

/** A demo board whose requests and published models are recorded. */
function recorded(dashboard: Dashboard = demoDashboard) {
  const env = demoEnv();
  const calls: RequestCall[] = [];
  env.setAround((call, run) => {
    calls.push(call);
    return run();
  });
  const board = createBoardModel({ dashboard, env });
  const models: BoardModel[] = [board.getModel()];
  board.subscribe(() => {
    models.push(board.getModel());
  });
  return { env, board, calls, models };
}

const cellCount = (model: BoardModel) => Object.keys(model.cells).length;
const observed = (env: ReturnType<typeof demoEnv>) =>
  env.client
    .getQueryCache()
    .getAll()
    .reduce((sum, q) => sum + q.getObserversCount(), 0);

describe('createBoardModel', () => {
  it('fills progressively, runs before jobs before behind counts', async () => {
    const { env, board, calls, models } = recorded();
    expect(cellCount(board.getModel())).toBe(0);
    const final = await settle(env, board);
    const firstOf = (kind: string) => calls.findIndex((c) => c.kind === kind);
    expect(firstOf('runs')).toBeGreaterThanOrEqual(0);
    expect(firstOf('runs')).toBeLessThan(firstOf('jobs'));
    expect(firstOf('jobs')).toBeLessThan(firstOf('compare'));
    // Provisional cells showed before the jobs landed; none remain.
    expect(
      models.some((m) => Object.values(m.cells).some((c) => c?.provisional)),
    ).toBe(true);
    expect(Object.values(final.cells).every((c) => c?.settled)).toBe(true);
    expect(Object.values(final.cells).some((c) => c?.provisional)).toBe(false);
    // A cell, once shown, never goes back to a skeleton.
    for (let i = 1; i < models.length; i += 1)
      for (const key of Object.keys(models[i - 1]?.cells ?? {}))
        expect(models[i]?.cells[key]).toBeDefined();
    board.destroy();
  });

  it('reads no compares for an Amplify row without a repo, so it shows no badges', async () => {
    const compared = (calls: RequestCall[], repo: string | undefined) =>
      calls.some((c) => c.kind === 'compare' && c.repo === repo);
    const linked = demoDashboard.rows.find((r) => r.type === 'amplify');
    if (!linked) throw new Error('the demo has no Amplify row');
    const withRepo = recorded();
    await settle(withRepo.env, withRepo.board);
    expect(compared(withRepo.calls, linked.repo)).toBe(true);
    withRepo.board.destroy();

    const noRepo = recorded({
      ...demoDashboard,
      rows: demoDashboard.rows.map((r) =>
        r.id === linked.id ? omit(linked, ['repo']) : r,
      ),
    });
    const final = await settle(noRepo.env, noRepo.board);
    expect(compared(noRepo.calls, linked.repo)).toBe(false);
    const cells = Object.values(final.cells).filter(
      (c) => c?.rowId === linked.id,
    );
    expect(cells.length).toBe(demoDashboard.stages.length);
    expect(cells.every((c) => c?.settled && c.badge === undefined)).toBe(true);
    noRepo.board.destroy();
  });

  it('re-derives only the rows a changed query feeds', async () => {
    const { env, board, calls } = recorded();
    const before = await settle(env, board);
    const runs = calls.find((c) => c.kind === 'runs');
    const query = env.client
      .getQueryCache()
      .getAll()
      .find(
        (q) =>
          JSON.stringify(q.queryKey).includes('"runs"') &&
          JSON.stringify(q.queryKey).includes(`"${runs?.repo ?? ''}"`),
      );
    if (!query) throw new Error('no runs query');
    env.client.setQueryData(query.queryKey, query.state.data);
    await Promise.resolve();
    const after = board.getModel();
    const changed = Object.keys(after.cells).filter(
      (key) => after.cells[key] !== before.cells[key],
    );
    const rowsOf = (keys: string[]) =>
      new Set(keys.map((key) => after.cells[key]?.rowId));
    expect(changed.length).toBeGreaterThan(0);
    expect(changed.length).toBeLessThan(Object.keys(after.cells).length);
    const repoRows = demoDashboard.rows
      .filter((r) => r.type === 'github' && r.repo === runs?.repo)
      .map((r) => r.id);
    expect(
      [...rowsOf(changed)].every((id) => repoRows.includes(id ?? '')),
    ).toBe(true);
    board.destroy();
  });

  it('applies an edit from the cache at once, keeping the board filled', async () => {
    const { env, board, calls } = recorded();
    const before = await settle(env, board);
    const read = calls.length;
    const next: Dashboard = {
      ...demoDashboard,
      settings: {
        ...demoDashboard.settings,
        requestsInFlight: { github: 3, aws: 40 },
      },
    };
    board.setDashboard(next);
    // Synchronously re-derived: every cell still there.
    expect(cellCount(board.getModel())).toBe(cellCount(before));
    await settle(env, board);
    expect(calls.length).toBe(read);
    const token = calls.find((c) => c.provider === 'github');
    const key = calls.find((c) => c.provider === 'amplify');
    expect(
      env.limiters.for('github', token?.credentialId ?? '').stats().max,
    ).toBe(3);
    expect(
      env.limiters.for('amplify', key?.credentialId ?? '').stats().max,
    ).toBe(40);
    board.destroy();
  });

  it('drops a removed row and stops observing what only it needed', async () => {
    const { env, board } = recorded();
    await settle(env, board);
    const watching = observed(env);
    const [gone] = demoDashboard.rows;
    board.setDashboard({
      ...demoDashboard,
      rows: demoDashboard.rows.slice(1),
    });
    const after = board.getModel();
    expect(Object.values(after.cells).some((c) => c?.rowId === gone.id)).toBe(
      false,
    );
    expect(observed(env)).toBeLessThan(watching);
    board.destroy();
  });

  it('observes and publishes nothing once destroyed', async () => {
    const { env, board, models } = recorded();
    await settle(env, board);
    expect(observed(env)).toBeGreaterThan(0);
    board.destroy();
    expect(observed(env)).toBe(0);
    const published = models.length;
    await env.client.refetchQueries();
    await settle(env, board);
    expect(models.length).toBe(published);
  });

  it('stops listening to the cache and budgets once destroyed', async () => {
    const env = demoEnv();
    const heard: number[] = [];
    const subscribe = env.budgets.subscribe.bind(env.budgets);
    env.budgets.subscribe = (listener) =>
      subscribe(() => {
        heard.push(1);
        listener();
      });
    const board = createBoardModel({ dashboard: demoDashboard, env });
    await settle(env, board);
    expect(env.client.getQueryCache().hasListeners()).toBe(true);
    board.destroy();
    expect(env.client.getQueryCache().hasListeners()).toBe(false);
    const before = heard.length;
    env.budgets.note('demo-github', {
      limit: 5000,
      remaining: 1,
      reset: 0,
      used: 4999,
      status: 'low',
    });
    expect(heard.length).toBe(before);
  });

  it('does nothing for a change that lands as it is destroyed', async () => {
    const { env, board } = recorded();
    await settle(env, board);
    const query = env.client
      .getQueryCache()
      .getAll()
      .find((q) => q.getObserversCount() > 0);
    if (!query) throw new Error('no observed query');
    env.client.setQueryData(query.queryKey, query.state.data);
    board.destroy();
    await Promise.resolve();
    expect(observed(env)).toBe(0);
  });

  it('drops the Unmapped runs of a repo or app no row reads any more', async () => {
    const { env, board } = recorded();
    const before = await settle(env, board);
    const run = before.unmapped.at(0);
    if (!run) throw new Error('the demo has no Unmapped runs');
    const readers = new Set(run.rows.map((r) => r.rowId));
    board.setDashboard({
      ...demoDashboard,
      rows: demoDashboard.rows.filter((r) => !readers.has(r.id)),
    });
    expect(board.getModel().unmapped.map((u) => u.id)).not.toContain(run.id);
    board.destroy();
  });

  it('re-derives the rows a removed query fed', async () => {
    const { env, board, models } = recorded();
    await settle(env, board);
    const row = demoDashboard.rows.find((r) => r.type === 'github');
    if (row?.type !== 'github') throw new Error('no GitHub row');
    const shown = (m: BoardModel) =>
      Object.values(m.cells).some((c) => c?.rowId === row.id);
    expect(shown(board.getModel())).toBe(true);
    const published = models.length;
    env.client.removeQueries({
      queryKey: ['github', 'demo-github', { call: 'runs', repo: row.repo }],
    });
    await Promise.resolve();
    expect(models.slice(published).some((m) => !shown(m))).toBe(true);
    board.destroy();
  });
});
