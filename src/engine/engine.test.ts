/**
 * Tests for the board engine over the demo providers (spec.md C-23: every
 * state the demo promises shows up through the real pipeline), plus a
 * missing credential, rate limiting and polling cadence.
 *
 * @module
 */
import { describe, expect, it, vi } from 'vitest';

import { demoDashboard } from '@/demo/board';
import { createDemoGitHubReader } from '@/demo/github';
import { RateLimitedError } from '@/lib/github';

import { demoProviders } from './demoProviders';
import { createBoardEngine } from './engine';
import { ACTIVE_INTERVAL_MS, type Visibility } from './scheduler';
import { type BoardModel, cellKey } from './types';

const visible: Visibility = { isHidden: () => false, onChange: () => () => {} };

const cell = (model: BoardModel, row: string, stage: string) =>
  model.cells[cellKey(row, stage)];

async function demoModel(): Promise<BoardModel> {
  const engine = createBoardEngine({
    dashboard: demoDashboard,
    providers: demoProviders(() => 0),
    visibility: visible,
  });
  await engine.refreshAll();
  return engine.getModel();
}

describe('board engine over the demo', () => {
  it('fills every cell of the 19 x 6 board', async () => {
    expect(Object.keys((await demoModel()).cells)).toHaveLength(19 * 6);
  });

  it('shows every status, empty state and badge', async () => {
    const model = await demoModel();
    const cells = Object.values(model.cells).filter((c) => c !== undefined);
    const seen = new Set(
      cells.map((c) =>
        c.derivation.kind === 'ok' ? c.derivation.status : c.derivation.state,
      ),
    );
    expect([...seen].sort()).toEqual(
      [
        'success',
        'partialSuccess',
        'started',
        'queued',
        'failure',
        'cancelled',
        'no-branch',
        'no-recent-runs',
        'needs-credential',
        'error',
      ].sort(),
    );
    expect(cell(model, 'billing', 'test')?.badge).toEqual({
      kind: 'behind',
      count: 3,
    });
    expect(cell(model, 'orders', 'staging')?.badge).toMatchObject({
      kind: 'diverged',
    });
    expect(
      cell(model, 'billing', 'test')?.compare?.behindSubjects,
    ).toHaveLength(3);
  });

  it('lists the two unmapped demo runs with their reasons', async () => {
    const reasons = (await demoModel()).unmapped.map(
      (u) => `${u.rowId}:${u.reason.kind}`,
    );
    expect(reasons).toEqual(
      expect.arrayContaining([
        'api-core:no-stage-matches-branch',
        'web-app:no-phase-matches-job',
      ]),
    );
  });

  it('records the GitHub budget per credential', async () => {
    expect((await demoModel()).budgets['demo-github']).toMatchObject({
      limit: 5000,
    });
  });
});

describe('board engine credentials and limits', () => {
  it('shows needs credential when a token is missing', async () => {
    const engine = createBoardEngine({
      dashboard: demoDashboard,
      providers: { ...demoProviders(() => 0), github: () => undefined },
      visibility: visible,
    });
    await engine.refreshAll();
    expect(
      cell(engine.getModel(), 'api-core', 'dev')?.derivation,
    ).toMatchObject({
      kind: 'empty',
      state: 'needs-credential',
    });
  });

  it('keeps the previous cells while rate limited', async () => {
    const reader = createDemoGitHubReader(() => 0);
    const engine = createBoardEngine({
      dashboard: demoDashboard,
      providers: { ...demoProviders(() => 0), github: () => reader },
      visibility: visible,
    });
    await engine.refreshAll();
    const before = cell(engine.getModel(), 'api-core', 'dev');
    vi.spyOn(reader, 'listWorkflowRuns').mockRejectedValue(
      new RateLimitedError('runs', 0),
    );
    await engine.refreshAll();
    expect(cell(engine.getModel(), 'api-core', 'dev')).toBe(before);
  });
});

describe('board engine polling', () => {
  it('refreshes on start and again on the active interval', async () => {
    vi.useFakeTimers();
    try {
      const listener = vi.fn();
      const engine = createBoardEngine({
        dashboard: demoDashboard,
        providers: demoProviders(() => 0),
        visibility: visible,
      });
      engine.subscribe(listener);
      engine.start();
      await vi.advanceTimersByTimeAsync(0);
      const afterStart = listener.mock.calls.length;
      expect(afterStart).toBeGreaterThanOrEqual(19);
      await vi.advanceTimersByTimeAsync(ACTIVE_INTERVAL_MS);
      // Only rows with active runs repoll on the short interval.
      expect(listener.mock.calls.length - afterStart).toBeGreaterThan(0);
      expect(listener.mock.calls.length - afterStart).toBeLessThan(19);
      engine.stop();
    } finally {
      vi.useRealTimers();
    }
  });
});
