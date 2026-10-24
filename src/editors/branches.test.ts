/**
 * Tests for editor branch discovery (spec.md C-21): each repo read once
 * with its row's inherited token, rows without a token or a repo skipped, branch
 * counts across repos, and pattern previews.
 *
 * @module
 */
import { describe, expect, it, vi } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { fakeGitHubApi, fetched, ghBranch } from '@/test/fakeReaders';
import { testQueryEnv } from '@/test/queryEnv';

import { branchCounts, discoverBranches, patternPreview } from './branches';

describe('discoverBranches', () => {
  it('reads with the first token its cells read that has a secret', async () => {
    const dashboard = DashboardSchema.parse({
      id: 'd',
      name: 'd',
      credentials: [
        { id: 'unentered', kind: 'github', label: 'unentered' },
        { id: 'org', kind: 'github', label: 'org' },
      ],
      settings: { githubToken: 'org' },
      stages: [
        { id: 'dev', name: 'Dev' },
        { id: 'prod', name: 'Prod' },
      ],
      rows: [
        {
          type: 'github',
          id: 'a',
          repo: 'acme/a',
          displayName: 'a',
          cellSettings: { dev: { githubToken: 'unentered' } },
        },
      ],
    });
    const branchesPage = vi.fn(() =>
      Promise.resolve(fetched([ghBranch('main')])),
    );
    const env = testQueryEnv({
      github: (id) =>
        id === 'org' ? fakeGitHubApi({ branchesPage }) : undefined,
      amplify: () => undefined,
    });
    expect([...(await discoverBranches(dashboard, env))]).toEqual([
      ['acme/a', ['main']],
    ]);
  });

  it('reads each repo once, with a token its cells read, skipping rows without a repo', async () => {
    const dashboard = DashboardSchema.parse({
      id: 'd',
      name: 'd',
      credentials: [
        { id: 'org', kind: 'github', label: 'org' },
        { id: 'team', kind: 'github', label: 'team' },
      ],
      settings: { githubToken: 'org' },
      rows: [
        { type: 'github', id: 'a', repo: 'acme/a', displayName: 'a' },
        { type: 'github', id: 'a2', repo: 'acme/a', displayName: 'a2' },
        { type: 'github', id: 'b', repo: 'acme/b', displayName: 'b' },
        { type: 'github', id: 'c', repo: 'acme/c', displayName: 'c' },
        {
          type: 'amplify',
          id: 'site',
          displayName: 'site',
          pinnedApps: [{ region: 'us-east-1', appId: 'a1' }],
        },
      ],
      rowGroups: [
        { id: 'g', memberIds: ['b'], settings: { githubToken: 'team' } },
      ],
    });
    const branchesPage = vi.fn(({ repo }: { repo: string }) =>
      Promise.resolve(fetched([ghBranch(`${repo}-main`)])),
    );
    const read: string[] = [];
    const env = testQueryEnv({
      github: (id) => {
        read.push(id);
        return id === 'org' || id === 'team'
          ? fakeGitHubApi({ branchesPage })
          : undefined;
      },
      amplify: () => undefined,
    });
    const found = await discoverBranches(dashboard, env);
    expect([...found]).toEqual([
      ['acme/a', ['a-main']],
      ['acme/b', ['b-main']],
      ['acme/c', ['c-main']],
    ]);
    // Each repo is read with the token its row inherits.
    expect(branchesPage).toHaveBeenCalledTimes(3);
    expect(new Set(read)).toEqual(new Set(['org', 'team']));

    const noToken = {
      ...dashboard,
      settings: { requestsInFlight: dashboard.settings.requestsInFlight },
      rowGroups: [],
    };
    const env2 = testQueryEnv({ github: () => undefined });
    expect((await discoverBranches(noToken, env2)).size).toBe(0);
  });
});

describe('branch counts and previews', () => {
  const byRepo = new Map([
    ['acme/a', ['main', 'release/24.3', 'release/24.2']],
    ['acme/b', ['main', 'release/24.3']],
    ['acme/c', ['main']],
  ]);

  it('counts branches across repos, most common first', () => {
    expect(branchCounts(byRepo)).toEqual([
      { name: 'main', count: 3 },
      { name: 'release/24.3', count: 2 },
      { name: 'release/24.2', count: 1 },
    ]);
  });

  it('previews what a pattern matches', () => {
    expect(patternPreview('release/**', byRepo)).toEqual({
      repos: ['acme/a', 'acme/b'],
      branches: ['release/24.2', 'release/24.3'],
    });
    expect(patternPreview('  ', byRepo).repos).toEqual([]);
  });
});
