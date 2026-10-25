/**
 * Tests for the board model's polling (spec.md §3.1, Decision 26): a token
 * crossing half its budget re-derives its rows, slowing their polls four
 * times (and back once under), with the budget published for the battery;
 * a run that completes refetches its jobs once more (its jobs' version
 * changed), after which they never poll.
 *
 * @module
 */
import type { Query } from '@tanstack/query-core';
import { describe, expect, it } from 'vitest';

import { measureBoard } from '@/demo/scenarios/measure';
import { MINUTE } from '@/demo/scenarios/pipeline';
import type { RateLimitBudget } from '@/lib/github';
import { createQueryEnv } from '@/query/client';
import { BUDGET_BACKOFF, IDLE_INTERVAL_MS } from '@/query/intervals';
import { QueryKeySchema } from '@/query/keys';
import { settle, withoutRetryDelay } from '@/test/boardModel';
import { simProviders, simTransport } from '@/test/simDemo';

import { createBoardModel } from './boardModel';
import { githubCredentialIds } from './model';

const [TOKEN = ''] = githubCredentialIds(measureBoard);
const LIMIT = 5_000;
const budget = (used: number): RateLimitBudget => ({
  limit: LIMIT,
  used,
  remaining: LIMIT - used,
  reset: 0,
  status: 'ok',
});

/** A demo board on a clock the test moves, reporting budgets by hand. */
function setup() {
  const clock = { now: 0 };
  let report: (id: string, b: RateLimitBudget) => void = () => undefined;
  const env = withoutRetryDelay(
    createQueryEnv({
      providers: (hooks) => {
        const providers = simProviders(
          hooks,
          simTransport(() => clock.now),
        );
        report = (id, b) => {
          hooks.onBudget(id, b, providers.fingerprint(id));
        };
        return providers;
      },
    }),
  );
  const board = createBoardModel({ dashboard: measureBoard, env });
  return {
    env,
    board,
    clock,
    report: (b: RateLimitBudget) => {
      report(TOKEN, b);
    },
  };
}

const callOf = (query: Query) => {
  const key = QueryKeySchema.parse(query.queryKey);
  return key[0] === 'github' ? key[2].call : undefined;
};
const intervalsOf = (queries: Query[], call: string) =>
  new Set(
    queries
      .filter((q) => callOf(q) === call)
      .flatMap((q) => q.observers.map((o) => o.options.refetchInterval)),
  );

describe('board model polling', () => {
  it('slows a token past half its budget four times, and back', async () => {
    const { env, board, report } = setup();
    await settle(env, board);
    const all = () => env.client.getQueryCache().getAll();
    expect(intervalsOf(all(), 'compare')).toEqual(new Set([IDLE_INTERVAL_MS]));

    report(budget(LIMIT / 2 + 1));
    await Promise.resolve();
    expect(board.getModel().budgets[TOKEN]?.used).toBe(LIMIT / 2 + 1);
    expect(intervalsOf(all(), 'compare')).toEqual(
      new Set([IDLE_INTERVAL_MS * BUDGET_BACKOFF]),
    );

    report(budget(1));
    await Promise.resolve();
    expect(intervalsOf(all(), 'compare')).toEqual(new Set([IDLE_INTERVAL_MS]));
    board.destroy();
  });

  it('refetches a completed run’s jobs once, then never polls them', async () => {
    const { env, board, clock } = setup();
    await settle(env, board);
    const jobs = () =>
      env.client
        .getQueryCache()
        .getAll()
        .filter((q) => callOf(q) === 'jobs' && q.getObserversCount() > 0);
    const polling = jobs().filter((q) =>
      q.observers.some((o) => o.options.refetchInterval !== false),
    );
    expect(polling.length).toBeGreaterThan(0);
    const landed = new Map(polling.map((q) => [q, q.state.dataUpdatedAt]));

    // Hours later every demo run has finished; the runs lists say so.
    clock.now = 600 * MINUTE;
    await env.client.refetchQueries({
      predicate: (q) => callOf(q) === 'runs',
    });
    await settle(env, board);
    // Runs that completed settle their jobs after one last read (some
    // demo runs wait on an approval and keep polling).
    const finished = [...landed].filter(([query]) =>
      query.observers.every((o) => o.options.refetchInterval === false),
    );
    expect(finished.length).toBeGreaterThan(0);
    for (const [query, at] of finished)
      expect(query.state.dataUpdatedAt).toBeGreaterThan(at);
    board.destroy();
  });
});
