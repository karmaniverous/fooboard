/**
 * Tests for the editing helpers: reordering at the edges, readable unique
 * ids, rows from repos, independent duplicates, and branch discovery.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';

import {
  branchCounts,
  duplicateDashboard,
  moveItem,
  patternPreview,
  removeRow,
  removeStage,
  repoFromUrl,
  rowFromRepo,
  uniqueId,
} from './edit';

describe('repoFromUrl', () => {
  it('reads owner/name from a GitHub URL only', () => {
    expect(repoFromUrl('https://github.com/acme/web.git')).toBe('acme/web');
    expect(repoFromUrl('https://github.com/acme/web/')).toBe('acme/web');
    expect(repoFromUrl('https://gitlab.com/acme/web')).toBeUndefined();
    expect(repoFromUrl(undefined)).toBeUndefined();
  });
});

describe('removing rows and stages', () => {
  const d = DashboardSchema.parse({
    id: 'd',
    name: 'D',
    rows: [{ type: 'github', id: 'r', repo: 'o/r', displayName: 'r' }],
    stages: [
      { id: 'a', name: 'a', branchPattern: 'main' },
      { id: 'b', name: 'b', branchPattern: 'dev', sourceStageId: 'a' },
    ],
    rowGroups: [
      { id: 'g', memberIds: ['r'], branchPatternOverrides: { a: 'x/*' } },
    ],
    columnGroups: [{ id: 'cg', label: 'Prod', memberIds: ['a'] }],
  });

  it('takes the emptied group, the overrides and any source use with it', () => {
    expect(removeRow(d, 'r')).toMatchObject({ rows: [], rowGroups: [] });
    const s = DashboardSchema.parse(removeStage(d, 'a'));
    expect(s.stages).toEqual([{ id: 'b', name: 'b', branchPattern: 'dev' }]);
    expect(s.columnGroups).toEqual([]);
    expect(s.rowGroups[0]?.branchPatternOverrides).toEqual({});
  });
});

describe('moveItem', () => {
  it('moves within bounds and ignores moves past the ends', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, -2)).toEqual(['c', 'a', 'b']);
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b']);
  });
});

describe('uniqueId and rowFromRepo', () => {
  it('slugs, de-duplicates, and names a row after its repo', () => {
    expect(uniqueId('Release/24.3', [])).toBe('release-24-3');
    expect(uniqueId('api', ['api', 'api-2'])).toBe('api-3');
    const d = DashboardSchema.parse({ id: 'd', name: 'D' });
    expect(rowFromRepo('acme/api-core', d)).toMatchObject({
      id: 'api-core',
      repo: 'acme/api-core',
      displayName: 'api-core',
    });
  });
});

describe('duplicateDashboard', () => {
  it('re-keys every credential reference', () => {
    const d = DashboardSchema.parse({
      id: 'd',
      name: 'D',
      credentials: [{ id: 'c', kind: 'github', label: 'gh' }],
      defaultCredentials: { github: 'c' },
      rows: [
        {
          type: 'github',
          id: 'r',
          repo: 'o/r',
          displayName: 'r',
          credentialId: 'c',
        },
      ],
    });
    const copy = DashboardSchema.parse(
      duplicateDashboard(d, 'd2', 'D copy', (old) => `${old}-new`),
    );
    expect(copy).toMatchObject({ id: 'd2', name: 'D copy' });
    expect(JSON.stringify(copy)).not.toMatch(/"c"/);
    expect(copy.defaultCredentials.github).toBe('c-new');
    expect(d.credentials[0]?.id).toBe('c');
  });
});

describe('branch discovery', () => {
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
