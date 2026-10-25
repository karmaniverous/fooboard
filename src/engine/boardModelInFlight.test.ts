/**
 * Tests for *requests in flight* on a whole board (spec.md §3.2,
 * Decisions 10 and 44): at 1, every credential sends strictly one
 * request at a time, root and dependent reads alike, and the board still
 * fills; at the default, a credential has several running at once.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { measureBoard } from '@/demo/scenarios/measure';
import {
  MEASURE_AWS,
  MEASURE_GITHUB,
  MEASURE_REJECTED,
} from '@/demo/scenarios/measureBoard';
import type { Dashboard } from '@/domain/config/dashboard';
import { DEFAULT_REQUESTS_IN_FLIGHT } from '@/domain/config/settings';
import { demoEnv, settle } from '@/test/boardModel';

import { createBoardModel } from './boardModel';

/** The demo board at `cap` requests in flight for both platforms. */
const atCap = (cap: number): Dashboard => ({
  ...measureBoard,
  settings: {
    ...measureBoard.settings,
    requestsInFlight: { github: cap, aws: cap },
  },
});

/** Fill `dashboard`, recording the most requests each credential had
 * running at once. */
async function peaks(dashboard: Dashboard) {
  const env = demoEnv();
  const running = new Map<string, number>();
  const peak = new Map<string, number>();
  let requests = 0;
  env.setAround(async (call, run) => {
    const id = `${call.provider}:${call.credentialId}`;
    const now = (running.get(id) ?? 0) + 1;
    running.set(id, now);
    peak.set(id, Math.max(peak.get(id) ?? 0, now));
    requests += 1;
    try {
      // Hold the slot across a macrotask, so overlapping requests would
      // really overlap.
      await new Promise((resolve) => setTimeout(resolve, 0));
      return await run();
    } finally {
      running.set(id, (running.get(id) ?? 1) - 1);
    }
  });
  const board = createBoardModel({ dashboard, env });
  const model = await settle(env, board);
  board.destroy();
  return { peak, requests, model };
}

describe('requests in flight on the board', () => {
  it('at 1, sends one request at a time per credential and still fills the board', async () => {
    const { peak, requests, model } = await peaks(atCap(1));
    expect(requests).toBeGreaterThan(peak.size);
    // legacy-billing reads with a token of its own (rejected).
    expect([...peak.keys()].sort()).toEqual([
      `amplify:${MEASURE_AWS}`,
      `github:${MEASURE_GITHUB}`,
      `github:${MEASURE_REJECTED}`,
    ]);
    for (const most of peak.values()) expect(most).toBe(1);
    expect(Object.values(model.cells).every((c) => c?.settled)).toBe(true);
  });

  it('at the default, lets a credential run several at once', async () => {
    const { peak } = await peaks(atCap(DEFAULT_REQUESTS_IN_FLIGHT));
    expect(Math.max(...peak.values())).toBeGreaterThan(1);
    for (const most of peak.values())
      expect(most).toBeLessThanOrEqual(DEFAULT_REQUESTS_IN_FLIGHT);
  });
});
