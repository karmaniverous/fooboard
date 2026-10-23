/**
 * Tests that the demo providers drive the real query layer, mapping and
 * derivation to the states the demo promises (spec.md C-23): cells for
 * each status, both badges, the empty states, the two failing rows, the
 * multi-source Amplify row, and progress over time.
 *
 * @module
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { type BoardModel, cellKey } from '@/engine';
import { GitHubAuthError, GitHubHttpError } from '@/lib/github/errors';
import { demoEnv, fullModel } from '@/test/boardModel';

import { demoDashboard } from './board';
import { createDemoGitHubApi } from './github';

let model: BoardModel;
beforeAll(async () => {
  model = await fullModel(demoDashboard);
});

const cell = (rowId: string, stageId: string, of: BoardModel = model) =>
  of.cells[cellKey(rowId, stageId)];

describe('demo GitHub provider', () => {
  it.each([
    ['api-core', 'dev', 'success'],
    ['api-core', 'spokane', 'running'],
    ['web-app', 'bali', 'partial'],
    ['web-app', 'texas', 'queued'],
    ['mobile-bff', 'prod', 'failure'],
    ['payments', 'dev', 'cancelled'],
  ])('%s/%s derives %s', (repo, stageId, icon) => {
    expect(cell(repo, stageId)?.derivation).toMatchObject({
      kind: 'ok',
      status: { icon },
    });
  });

  it('skips the lint-only run and still derives the dev cell', () => {
    expect(cell('web-app', 'dev')?.derivation).toMatchObject({
      kind: 'ok',
      status: { icon: 'success' },
    });
  });

  it.each([
    ['auth-service', 'release', 'no-records'],
    ['inventory', 'texas', 'no-records'],
  ])('%s/%s is empty: %s', (repo, stageId, state) => {
    expect(cell(repo, stageId)?.derivation).toMatchObject({
      kind: 'empty',
      state,
    });
  });

  it.each([
    ['billing', 'bali', { kind: 'behind', count: 3 }],
    ['orders', 'spokane', { kind: 'diverged', behind: 4, ahead: 2 }],
    ['api-core', 'bali', undefined],
  ])('%s/%s vs its source stage: %o', (repo, stageId, badge) => {
    expect(cell(repo, stageId)?.badge).toEqual(badge);
  });

  it('fails the two broken rows the way real GitHub would', async () => {
    const api = createDemoGitHubApi(() => 0);
    await expect(
      api.runsPage({ owner: 'acme', repo: 'legacy-billing' }, 1),
    ).rejects.toBeInstanceOf(GitHubAuthError);
    await expect(
      api.runsPage({ owner: 'acme', repo: 'flaky-svc' }, 1),
    ).rejects.toBeInstanceOf(GitHubHttpError);
    expect(cell('legacy-billing', 'dev')?.derivation).toMatchObject({
      kind: 'empty',
      state: 'needs-credential',
    });
    expect(cell('flaky-svc', 'dev')?.derivation).toMatchObject({
      kind: 'empty',
      state: 'error',
    });
  });

  it('reports a run in progress while any of its jobs is', async () => {
    const api = createDemoGitHubApi(() => 0);
    const runs = await api.runsPage({ owner: 'acme', repo: 'api-core' }, 1);
    const statuses = runs.notModified ? [] : runs.data.map((r) => r.status);
    expect(statuses).toContain('in_progress');
    expect(statuses).toContain('completed');
  });

  it('moves started runs on to success as time passes', async () => {
    let now = 0;
    const env = demoEnv(() => now);
    // The demo's runs start when its token's port is first built.
    env.providers.github('demo-github');
    now = 2 * 60_000;
    const later = await fullModel(demoDashboard, env);
    expect(cell('api-core', 'spokane', later)?.derivation).toMatchObject({
      status: { icon: 'success' },
    });
  });
});

describe('demo Amplify provider', () => {
  it.each([
    ['marketing-site', 'spokane', 'running'],
    ['marketing-site', 'prod', 'failure'],
  ] as const)('%s/%s derives %s', (row, stageId, icon) => {
    expect(cell(row, stageId)?.derivation).toMatchObject({
      kind: 'ok',
      status: { icon },
    });
  });

  it('prefers the newer of the partner portal sources', () => {
    expect(cell('partner-portal', 'prod')?.derivation).toMatchObject({
      kind: 'ok',
      document: { _raw: { source: { appId: 'd1demopartnerus' } } },
    });
  });
});
