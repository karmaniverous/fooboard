/**
 * Tests for the board's first poll (spec 0.2.0 §3.J *Batteries and the
 * first poll*, Decision 109): opening a board reads every row's root
 * queries at once, even when the restored cache holds answers younger
 * than their poll interval (which TanStack counts as fresh, so before
 * the fix nothing read until the interval had passed); a first visit,
 * with nothing cached, and a reload of answers already stale, read each
 * root once, not twice; and a token paused for its rate limit still
 * waits.
 *
 * @module
 */
import { dehydrate, hydrate, type Query } from '@tanstack/query-core';
import { describe, expect, it } from 'vitest';

import { measureBoard } from '@/demo/scenarios/measure';
import { type QueryEnv } from '@/query/client';
import { QueryKeySchema } from '@/query/keys';
import { demoEnv, fullModel, settle } from '@/test/boardModel';

import { createBoardModel } from './boardModel';
import { githubCredentialIds } from './model';

const [TOKEN = ''] = githubCredentialIds(measureBoard);

/** One hour, the length of a GitHub rate-limit window. */
const HOUR_MS = 3_600_000;

/** A row's root query, one its poll reads (a repo's runs; an app's
 * branches and their jobs); an app search isn't one, though it shares
 * the roots' queue (`roleOf`). */
const isRoot = ({ queryKey }: Pick<Query, 'queryKey'>) => {
  const key = QueryKeySchema.parse(queryKey);
  return key[0] === 'github' ? key[2].call === 'runs' : key[2].call !== 'apps';
};

/** The root queries a board observes. */
const observedRoots = (env: QueryEnv) =>
  env.client
    .getQueryCache()
    .getAll()
    .filter((q) => isRoot(q) && q.getObserversCount() > 0);

/** Count each root query's fetches from now on. */
function countFetches(env: QueryEnv): Map<string, number> {
  const counts = new Map<string, number>();
  env.client.getQueryCache().subscribe((event) => {
    if (
      event.type === 'updated' &&
      event.action.type === 'fetch' &&
      isRoot(event.query)
    )
      counts.set(
        event.query.queryHash,
        (counts.get(event.query.queryHash) ?? 0) + 1,
      );
  });
  return counts;
}

/** An environment holding a full board's answers, just read: as after a
 * reload, which restores them from IndexedDB. */
async function restoredEnv(age = 0): Promise<QueryEnv> {
  const before = demoEnv();
  await fullModel(measureBoard, before);
  const env = demoEnv();
  const saved = dehydrate(before.client);
  for (const { state } of saved.queries) state.dataUpdatedAt -= age;
  hydrate(env.client, saved);
  return env;
}

describe("a board's first poll", () => {
  it("reads every row's root queries at once, though the restored answers are fresh", async () => {
    const env = await restoredEnv();
    const fetched = countFetches(env);
    const board = createBoardModel({ dashboard: measureBoard, env });
    await settle(env, board);
    const roots = observedRoots(env);
    expect(roots.length).toBeGreaterThan(0);
    expect(roots.filter((q) => !fetched.has(q.queryHash))).toEqual([]);
    board.destroy();
  });

  it('reads each root query once on a first visit, not twice', async () => {
    const env = demoEnv();
    const fetched = countFetches(env);
    const board = createBoardModel({ dashboard: measureBoard, env });
    await settle(env, board);
    const roots = observedRoots(env);
    expect(roots.length).toBeGreaterThan(0);
    expect(new Set(roots.map((q) => fetched.get(q.queryHash)))).toEqual(
      new Set([1]),
    );
    board.destroy();
  });

  it('reads each restored root once when it is already stale, not twice', async () => {
    // Older than any poll interval: the observers read it as they mount.
    const env = await restoredEnv(2 * HOUR_MS);
    const fetched = countFetches(env);
    const board = createBoardModel({ dashboard: measureBoard, env });
    await settle(env, board);
    const roots = observedRoots(env);
    expect(roots.length).toBeGreaterThan(0);
    expect(new Set(roots.map((q) => fetched.get(q.queryHash)))).toEqual(
      new Set([1]),
    );
    board.destroy();
  });

  it('leaves a token paused for its rate limit waiting', async () => {
    const env = await restoredEnv();
    const limiter = env.limiters.for('github', TOKEN);
    limiter.pauseUntil(Date.now() + HOUR_MS);
    const landed = new Map(
      env.client
        .getQueryCache()
        .getAll()
        .filter((q) => q.state.data !== undefined)
        .map((q) => [q.queryHash, q.state.dataUpdatedAt]),
    );
    const board = createBoardModel({ dashboard: measureBoard, env });
    await new Promise((resolve) => setTimeout(resolve, 0));
    // The restored ones: their answers stay as they were.
    const github = observedRoots(env).filter(
      (q) => q.queryKey[0] === 'github' && landed.has(q.queryHash),
    );
    expect(github.length).toBeGreaterThan(0);
    expect(limiter.stats().running).toBe(0);
    for (const q of github)
      expect(q.state.dataUpdatedAt).toBe(landed.get(q.queryHash));
    board.destroy();
  });
});
