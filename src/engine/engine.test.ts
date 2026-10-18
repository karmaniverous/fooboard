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
import { RowGroupSchema } from '@/domain/config/groups';
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
        c.derivation.kind === 'ok'
          ? c.derivation.status.icon
          : c.derivation.state,
      ),
    );
    expect([...seen].sort()).toEqual(
      [
        'success',
        'partial',
        'running',
        'queued',
        'failure',
        'cancelled',
        'no-branch',
        'no-recent-runs',
        'needs-credential',
        'error',
      ].sort(),
    );
    expect(cell(model, 'billing', 'bali')?.badge).toEqual({
      kind: 'behind',
      count: 3,
    });
    expect(cell(model, 'orders', 'spokane')?.badge).toMatchObject({
      kind: 'diverged',
    });
    expect(
      cell(model, 'billing', 'bali')?.compare?.behindSubjects,
    ).toHaveLength(3);
  });

  it('lists one unmapped demo run per reason', async () => {
    const reasons = (await demoModel()).unmapped.map(
      (u) => `${u.repo}:${u.reason.kind}`,
    );
    expect(reasons).toEqual(
      expect.arrayContaining([
        'acme/api-core:no-stage-matches-branch',
        'acme/web-app:no-relevant-job',
        'acme/payments:no-row-key-matches',
      ]),
    );
  });
});

describe('board engine credentials and limits', () => {
  it('reads a row with its own token when it overrides the default', async () => {
    const dashboard = {
      ...demoDashboard,
      credentials: [
        ...demoDashboard.credentials,
        { id: 'org-b', kind: 'github' as const, label: 'Org B' },
      ],
      rows: demoDashboard.rows.map((r) =>
        r.id === 'api-core' ? { ...r, credentialId: 'org-b' } : r,
      ),
    };
    const demo = demoProviders(() => 0);
    const engine = createBoardEngine({
      dashboard,
      // Only the default token is entered; org-b is missing.
      providers: {
        ...demo,
        github: (id) => (id === 'org-b' ? undefined : demo.github(id)),
      },
      visibility: visible,
    });
    await engine.refreshAll();
    const model = engine.getModel();
    expect(cell(model, 'api-core', 'dev')?.derivation).toMatchObject({
      state: 'needs-credential',
    });
    expect(cell(model, 'web-app', 'dev')?.derivation).toMatchObject({
      kind: 'ok',
    });
  });

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

  it("reads each row's effective branch and inherited token (C-14c, C-1a)", async () => {
    const demo = demoProviders(() => 0);
    const dashboard = {
      ...demoDashboard,
      credentials: [
        ...demoDashboard.credentials,
        { id: 'org-b', kind: 'github' as const, label: 'Org B' },
      ],
      // api-core moves to a group whose token isn't entered.
      rowGroups: [
        ...demoDashboard.rowGroups.map((g) => ({
          ...g,
          memberIds: g.memberIds.filter((id) => id !== 'api-core'),
        })),
        RowGroupSchema.parse({
          id: 'locked',
          memberIds: ['api-core'],
          defaultCredentials: { github: 'org-b' },
        }),
      ],
    };
    const engine = createBoardEngine({
      dashboard,
      providers: {
        ...demo,
        github: (id) => (id === 'org-b' ? undefined : demo.github(id)),
      },
      visibility: visible,
    });
    await engine.refreshAll();
    const model = engine.getModel();
    expect(cell(model, 'marketing-site', 'release')?.derivation).toMatchObject({
      branch: 'preview/release',
    });
    expect(cell(model, 'billing', 'release')?.derivation).toMatchObject({
      branch: 'release/24.3',
    });
    expect(cell(model, 'api-core', 'dev')?.derivation).toMatchObject({
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
    const exhausted = {
      limit: 5000,
      remaining: 0,
      reset: 0,
      used: 5000,
      status: 'low' as const,
    };
    vi.spyOn(reader, 'getBudget').mockReturnValue(exhausted);
    await engine.refreshAll();
    expect(cell(engine.getModel(), 'api-core', 'dev')).toBe(before);
    // The budget GitHub reported still reaches the model and scheduler.
    expect(engine.getModel().budgets['demo-github']).toEqual(exhausted);
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

describe('board engine review regressions', () => {
  const twoRowsOnApiCore = {
    ...demoDashboard,
    rows: [
      ...demoDashboard.rows,
      {
        type: 'github' as const,
        id: 'api-core-worker',
        repo: 'acme/api-core',
        displayName: 'api-core worker',
        rowKeyTests: [
          {
            field: 'jobName' as const,
            operator: 'contains' as const,
            value: 'deploy',
          },
        ],
        branchPatternOverrides: {},
        cellStatusSets: {},
      },
    ],
  };

  it('reads a shared repo once and lists its unmapped runs once', async () => {
    const reader = createDemoGitHubReader(() => 0);
    const runs = vi.spyOn(reader, 'listWorkflowRuns');
    const engine = createBoardEngine({
      dashboard: twoRowsOnApiCore,
      providers: { ...demoProviders(() => 0), github: () => reader },
      visibility: visible,
    });
    await engine.refreshAll();
    const apiCoreCalls = runs.mock.calls.filter(([r]) => r.repo === 'api-core');
    expect(apiCoreCalls).toHaveLength(1);
    const hotfix = engine
      .getModel()
      .unmapped.filter((u) => u.branch === 'hotfix/login');
    expect(hotfix).toHaveLength(1);
  });

  it('joins a running refresh instead of overlapping it', async () => {
    const reader = createDemoGitHubReader(() => 0);
    const runs = vi.spyOn(reader, 'listWorkflowRuns');
    const engine = createBoardEngine({
      dashboard: demoDashboard,
      providers: { ...demoProviders(() => 0), github: () => reader },
      visibility: visible,
    });
    await Promise.all([engine.refreshAll(), engine.refreshAll()]);
    expect(runs.mock.calls.filter(([r]) => r.repo === 'api-core')).toHaveLength(
      1,
    );
  });

  it('marks a cell active while a job is queued, whatever it displays', async () => {
    const model = await demoModel();
    // Partial success: deploy done, test still queued.
    expect(cell(model, 'web-app', 'bali')?.active).toBe(true);
    expect(cell(model, 'mobile-bff', 'prod')?.active).toBe(false);
  });

  it('keeps cells apart when ids contain the key separator', () => {
    expect(cellKey('a:b', 'c')).not.toBe(cellKey('a', 'b:c'));
  });
});
