/**
 * Tests for the opt-in regions' time limit (spec.md §3.1 *Amplify
 * regions*, §3.12, Q33): an opt-in region that hasn't answered within
 * `OPT_IN_REGION_TIMEOUT_MS` has its request aborted, over the real SDK,
 * and is skipped as unreachable; one that answers in time is listed and
 * leaves no timer behind; a standard region has no limit.
 *
 * @module
 */
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { amplifyApp } from '@/lib/amplify/sdkShapes';
import {
  cannedReader,
  silentReader,
  type SilentTally,
} from '@/test/amplifySdk';

import {
  listRegion,
  OPT_IN_REGION_TIMEOUT_MS,
  OPT_IN_REGIONS,
} from './regions';

const app = amplifyApp({ appId: 'd1' });

/** `apps` after `ms`, on the (fake) clock. */
const answerAfter = (ms: number) => () =>
  new Promise<(typeof app)[]>((resolve) => {
    setTimeout(() => {
      resolve([app]);
    }, ms);
  });

/** `region`'s listing, and whether it has settled yet. */
function listing(region: string, listIn: Parameters<typeof listRegion>[1]) {
  const state = { settled: false };
  const listed = listRegion(region, listIn).finally(() => {
    state.settled = true;
  });
  return { listed, state };
}

describe("an opt-in region's time limit", () => {
  beforeAll(async () => {
    // The SDK loads parts of itself on its first request, on the real
    // clock; load them before the clock is faked.
    await cannedReader('me-south-1', { statusCode: 200, body: {} }).listApps();
  });
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('aborts a silent opt-in request at the limit and skips the region as unreachable', async () => {
    const tally: SilentTally = { sent: 0, aborted: 0 };
    const reader = silentReader('me-south-1', tally);
    const { listed, state } = listing('me-south-1', (_, signal) =>
      reader.listApps(signal),
    );
    await vi.advanceTimersByTimeAsync(OPT_IN_REGION_TIMEOUT_MS - 1);
    expect(state.settled).toBe(false);
    expect(tally).toEqual({ sent: 1, aborted: 0 });
    await vi.advanceTimersByTimeAsync(1);
    await expect(listed).resolves.toEqual({ apps: [], skipped: 'unreachable' });
    expect(tally).toEqual({ sent: 1, aborted: 1 });
  });

  it.each([...OPT_IN_REGIONS])(
    'lists %s when it answers within the limit, leaving no timer',
    async (region) => {
      let signal: AbortSignal | undefined;
      const { listed } = listing(region, (_, given) => {
        signal = given;
        return answerAfter(OPT_IN_REGION_TIMEOUT_MS - 1)();
      });
      await vi.advanceTimersByTimeAsync(OPT_IN_REGION_TIMEOUT_MS - 1);
      await expect(listed).resolves.toEqual({ apps: [app] });
      expect(signal?.aborted).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("still fails the listing on an opt-in region's other error within the limit", async () => {
    const error = new Error('boom');
    const { listed } = listing('eu-south-1', () => Promise.reject(error));
    await expect(listed).rejects.toBe(error);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('never cuts off a slow standard region, nor aborts its request', async () => {
    const tally: SilentTally = { sent: 0, aborted: 0 };
    const reader = silentReader('us-east-1', tally);
    const silent = listing('us-east-1', (_, signal) => reader.listApps(signal));
    const slow = listing(
      'us-east-1',
      answerAfter(OPT_IN_REGION_TIMEOUT_MS * 10),
    );
    await vi.advanceTimersByTimeAsync(OPT_IN_REGION_TIMEOUT_MS * 10);
    await expect(slow.listed).resolves.toEqual({ apps: [app] });
    expect(silent.state.settled).toBe(false);
    expect(tally).toEqual({ sent: 1, aborted: 0 });
  });
});
