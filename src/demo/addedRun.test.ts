/**
 * Tests for the demo's added run (spec.md C-23, Decision 46 item 4): the
 * run is listed only from its time on, in progress and then successful;
 * its jobs alone answer after a wait; and on the board its cell shows the
 * last placement with the refreshing dot until those jobs land, then the
 * new run, unmarked.
 *
 * @module
 */
import { describe, expect, it, vi } from 'vitest';

import { createBoardModel } from '@/engine/boardModel';
import { cellKey } from '@/engine/types';
import type { WorkflowRun } from '@/lib/github/schemas';
import { githubKey } from '@/query/keys';
import { demoEnv, settle } from '@/test/boardModel';
import { DEMO_TOKEN } from '@/test/githubCache';

import {
  ADDED_RUN_AT_MS,
  ADDED_RUN_CELL,
  ADDED_RUN_DURATION_MS,
  ADDED_RUN_JOBS_DELAY_MS,
} from './addedRun';
import { demoDashboard } from './board';
import { createDemoGitHubApi } from './github';
import { scenarioFor, stageBranch } from './scenarios';

const ref = { owner: 'acme', repo: ADDED_RUN_CELL.rowId };
const branch = stageBranch(ADDED_RUN_CELL.stageId);

/** The demo port at demo time \`at()\`, recording every wait. */
function port(at: () => number) {
  const waits: number[] = [];
  const api = createDemoGitHubApi(at, undefined, (ms) => {
    waits.push(ms);
    return Promise.resolve();
  });
  const branchRuns = async (): Promise<WorkflowRun[]> => {
    const res = await api.runsPage(ref, 1);
    if (res.notModified) throw new Error('the demo never answers 304');
    return res.data.filter((r) => r.head_branch === branch);
  };
  return { api, waits, branchRuns };
}

describe('demo added run', () => {
  it('is listed from its time on, newest, running and then successful', async () => {
    let now = 0;
    const { branchRuns } = port(() => now);
    const [before] = await branchRuns();
    expect(before.status).toBe('completed');

    now = ADDED_RUN_AT_MS - 1;
    expect((await branchRuns()).map((r) => r.id)).toEqual([before.id]);

    now = ADDED_RUN_AT_MS;
    const [added, previous] = await branchRuns();
    expect(previous.id).toBe(before.id);
    expect(added.id).not.toBe(before.id);
    expect(added.status).toBe('in_progress');

    now = ADDED_RUN_AT_MS + ADDED_RUN_DURATION_MS;
    const [done] = await branchRuns();
    expect(done).toMatchObject({
      id: added.id,
      status: 'completed',
      conclusion: 'success',
    });
  });

  it('answers the added run’s jobs alone after a wait', async () => {
    let now = 0;
    const { api, waits, branchRuns } = port(() => now);
    now = ADDED_RUN_AT_MS;
    const [added, previous] = await branchRuns();
    await api.jobsPage(ref, previous.id, 1);
    expect(waits).toEqual([]);
    const jobs = await api.jobsPage(ref, added.id, 1);
    expect(waits).toEqual([ADDED_RUN_JOBS_DELAY_MS]);
    expect(jobs.notModified ? [] : jobs.data.map((j) => j.status)).toEqual([
      'in_progress',
      'queued',
    ]);
  });

  it('shows its cell refreshing until the added run’s jobs land', async () => {
    let now = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<undefined>((resolve) => {
      release = () => {
        resolve(undefined);
      };
    });
    const env = demoEnv(
      () => now,
      () => gate,
    );
    const board = createBoardModel({ dashboard: demoDashboard, env });
    const key = cellKey(ADDED_RUN_CELL.rowId, ADDED_RUN_CELL.stageId);
    const before = (await settle(env, board)).cells[key];
    expect(before).toMatchObject({ derivation: { kind: 'ok' } });
    expect(before?.refreshing).toBeUndefined();
    // A partial cell (its tests queued for good) keeps the row polling at
    // the in-progress interval, so the added run shows within one poll.
    const partial = demoDashboard.stages.filter(
      (s) => scenarioFor(ADDED_RUN_CELL.rowId, s.id) === 'partial',
    );
    expect(partial.length).toBeGreaterThan(0);
    const model = board.getModel();
    for (const s of partial)
      expect(model.cells[cellKey(ADDED_RUN_CELL.rowId, s.id)]?.active).toBe(
        true,
      );
    const commitOf = (c: typeof before) =>
      c?.derivation.kind === 'ok' ? c.derivation.commit : undefined;

    now = ADDED_RUN_AT_MS;
    const row = demoDashboard.rows.find((r) => r.id === ADDED_RUN_CELL.rowId);
    void env.client.refetchQueries({
      queryKey: githubKey(DEMO_TOKEN, {
        call: 'runs',
        repo: row?.repo ?? '',
        page: 1,
      }),
    });
    await vi.waitFor(() => {
      expect(board.getModel().cells[key]?.refreshing).toBe(true);
    });
    // The last placement stays while the added run's jobs load.
    expect(commitOf(board.getModel().cells[key])).toBe(commitOf(before));

    release();
    const after = (await settle(env, board)).cells[key];
    expect(after?.refreshing).toBeUndefined();
    expect(commitOf(after)).not.toBe(commitOf(before));
    expect(after?.derivation).toMatchObject({ status: { icon: 'running' } });
    board.destroy();
  });
});
