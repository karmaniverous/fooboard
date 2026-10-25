/**
 * Tests for a board whose app search meets a silent opt-in region (spec.md
 * §3.1 *Amplify regions*, §3.12, Q33): the row found by repo loads until
 * the region's time limit, then lists the other regions' apps; the
 * dashboard note names the region as one that didn't answer; and the skip
 * is kept like any other answer, so a reload doesn't ask the region again.
 *
 * @module
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OPT_IN_REGION_TIMEOUT_MS } from '@/lib/amplify/regions';
import type { QueryEnv } from '@/query/client';
import {
  cannedReader,
  OPT_IN_REJECTION,
  silentReader,
  type SilentTally,
} from '@/test/amplifySdk';
import { settle } from '@/test/boardModel';
import {
  FOUND,
  foundByRepoDashboard as dashboard,
  foundByRepoEnv,
  reloadInto,
} from '@/test/foundByRepo';

import { createBoardModel } from './boardModel';
import { type BoardModel, cellKey } from './types';

const SILENT = 'me-south-1';

/** The board's opt-in regions rejecting the key, but `SILENT`, which never
 * answers; the demo answers at once. */
const silentEnv = (tally: SilentTally): QueryEnv =>
  foundByRepoEnv(
    (region) =>
      region === SILENT
        ? silentReader(region, tally)
        : cannedReader(region, OPT_IN_REJECTION),
    () => Promise.resolve(),
  );

/** Every opt-in region rejecting the key: the search's answer without the
 * silent region. */
const rejectingEnv = (): QueryEnv =>
  foundByRepoEnv((region) => cannedReader(region, OPT_IN_REJECTION));

const foundCells = (model: BoardModel) =>
  dashboard.stages.map((s) => model.cells[cellKey(FOUND, s.id)]);

const silentNotes = (model: BoardModel) =>
  model.problems.filter(
    (p) =>
      p.severity === 'note' &&
      p.message.includes(`skipped ${SILENT} (it didn't answer)`),
  );

/** Run the fake clock until nothing is fetching. */
async function settleFake(env: QueryEnv): Promise<void> {
  for (let i = 0; i < 1000 && env.client.isFetching() > 0; i += 1)
    await vi.advanceTimersByTimeAsync(1);
  expect(env.client.isFetching()).toBe(0);
}

describe('a silent opt-in region in the app search', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('lists the other regions at its limit, notes it, and keeps the skip for a reload', async () => {
    const reference = rejectingEnv();
    const referenceBoard = createBoardModel({ dashboard, env: reference });
    const expected = foundCells(await settle(reference, referenceBoard));
    referenceBoard.destroy();

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const tally: SilentTally = { sent: 0, aborted: 0 };
    const env = silentEnv(tally);
    const board = createBoardModel({ dashboard, env });
    await vi.advanceTimersByTimeAsync(OPT_IN_REGION_TIMEOUT_MS - 1);
    expect(foundCells(board.getModel()).some((c) => c?.settled)).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await settleFake(env);
    const model = board.getModel();
    board.destroy();
    vi.useRealTimers();

    expect(tally).toEqual({ sent: 1, aborted: 1 });
    expect(foundCells(model)).toEqual(expected);
    expect(foundCells(model).map((c) => c?.derivation.kind)).not.toContain(
      'empty',
    );
    expect(silentNotes(model)).toHaveLength(1);

    const again: SilentTally = { sent: 0, aborted: 0 };
    const after = reloadInto(env, silentEnv(again));
    const restored = createBoardModel({ dashboard, env: after });
    const first = restored.getModel();
    const amplifyFetching = after.client.isFetching({ queryKey: ['amplify'] });
    await settle(after, restored);
    restored.destroy();

    expect(amplifyFetching).toBe(0);
    expect(again.sent).toBe(0);
    expect(foundCells(first)).toEqual(expected);
    expect(silentNotes(first)).toHaveLength(1);
  });
});
