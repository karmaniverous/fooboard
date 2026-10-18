/**
 * Tests for editor branch discovery (spec.md C-21): each repo read once
 * with its row's inherited token, rows without a token skipped, branch
 * counts across repos, and pattern previews.
 *
 * @module
 */
import { describe, expect, it, vi } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import type { EngineProviders } from '@/engine';
import { fakeGitHubReader, ghBranch } from '@/test/fakeReaders';

import { branchCounts, discoverBranches, patternPreview } from './branches';

describe('discoverBranches', () => {
  it('reads each repo once, with the token the row inherits', async () => {
    const dashboard = DashboardSchema.parse({
      id: 'd',
      name: 'd',
      credentials: [
        { id: 'org', kind: 'github', label: 'org' },
        { id: 'team', kind: 'github', label: 'team' },
      ],
      defaultCredentials: { github: 'org' },
      rows: [
        { type: 'github', id: 'a', repo: 'acme/a', displayName: 'a' },
        { type: 'github', id: 'a2', repo: 'acme/a', displayName: 'a2' },
        { type: 'github', id: 'b', repo: 'acme/b', displayName: 'b' },
        { type: 'github', id: 'c', repo: 'acme/c', displayName: 'c' },
      ],
      rowGroups: [
        { id: 'g', memberIds: ['b'], defaultCredentials: { github: 'team' } },
      ],
    });
    const listBranches = vi.fn(({ repo }: { repo: string }) =>
      Promise.resolve([ghBranch(`${repo}-main`)]),
    );
    const read: string[] = [];
    const providers: EngineProviders = {
      github: (id) => {
        read.push(id);
        return id === 'org' || id === 'team'
          ? fakeGitHubReader({ listBranches })
          : undefined;
      },
      amplify: () => undefined,
    };
    const found = await discoverBranches(dashboard, providers);
    expect([...found]).toEqual([
      ['acme/a', ['a-main']],
      ['acme/b', ['b-main']],
      ['acme/c', ['c-main']],
    ]);
    expect(read).toEqual(['org', 'team', 'org']);

    const noToken = { ...dashboard, defaultCredentials: {}, rowGroups: [] };
    expect((await discoverBranches(noToken, providers)).size).toBe(0);
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
