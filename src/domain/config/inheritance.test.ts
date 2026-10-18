/**
 * Tests for inheritance (spec.md C-14c, C-1a): branch patterns resolve
 * row, then row group, then stage; credentials row, then row group, then
 * dashboard.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from './dashboard';
import {
  effectiveBranchPattern,
  effectiveStages,
  inheritedCredential,
  inheritedCredentials,
  rowGithubCredentialId,
} from './inheritance';

const release = { id: 'release', name: 'release', branchPattern: 'release/*' };
const dev = { id: 'dev', name: 'dev', branchPattern: 'dev' };
const frontend = {
  id: 'fe',
  memberIds: ['web'],
  branchPatternOverrides: { release: 'preview/release' },
  defaultCredentials: { github: 'team' },
  statusSets: {},
};

describe('branch patterns', () => {
  it.each([
    ['the stage', {}, undefined, 'release/*'],
    ['the row group', {}, frontend, 'preview/release'],
    ['the row', { release: 'rc/*' }, frontend, 'rc/*'],
  ])('resolve to %s', (_l, own, group, expected) => {
    expect(effectiveBranchPattern(release, own, group)).toBe(expected);
  });

  it('rewrite only the overridden stages a row sees', () => {
    const stages = [dev, release];
    const web = effectiveStages(
      { stages, rowGroups: [frontend] },
      { id: 'web', branchPatternOverrides: {} },
    );
    expect(web[0]).toBe(dev);
    expect(web[1]).toEqual({ ...release, branchPattern: 'preview/release' });
    const api = { id: 'api', branchPatternOverrides: {} };
    expect(effectiveStages({ stages, rowGroups: [frontend] }, api)).toEqual(
      stages,
    );
  });
});

describe('credentials', () => {
  const d = DashboardSchema.parse({
    id: 'd',
    name: 'd',
    credentials: [
      { id: 'org', kind: 'github', label: 'org' },
      { id: 'team', kind: 'github', label: 'team' },
      { id: 'own', kind: 'github', label: 'own' },
      { id: 'aws', kind: 'aws', label: 'aws' },
    ],
    defaultCredentials: { github: 'org', aws: 'aws' },
    rows: [
      { type: 'github', id: 'api', repo: 'acme/api', displayName: 'api' },
      { type: 'github', id: 'web', repo: 'acme/web', displayName: 'web' },
      {
        type: 'github',
        id: 'own',
        repo: 'acme/own',
        displayName: 'own',
        credentialId: 'own',
      },
    ],
    rowGroups: [{ ...frontend, memberIds: ['web', 'own'] }],
  });

  it('inherit per kind from the row group, else the dashboard', () => {
    expect(inheritedCredentials(d, 'web')).toEqual({
      github: 'team',
      aws: 'aws',
    });
    expect(inheritedCredentials(d, 'api')).toEqual({
      github: 'org',
      aws: 'aws',
    });
    expect(inheritedCredential(d, 'web', 'github')).toEqual({
      from: 'group',
      id: 'team',
    });
    expect(inheritedCredential(d, 'web', 'aws')).toEqual({
      from: 'dashboard',
      id: 'aws',
    });
  });

  it("pick a row's GitHub token: its own, else inherited", () => {
    const token = (id: string) =>
      rowGithubCredentialId(d, d.rows.find((r) => r.id === id) ?? d.rows[0]);
    expect([token('api'), token('web'), token('own')]).toEqual([
      'org',
      'team',
      'own',
    ]);
  });

  it('ignores Object.prototype names as overrides (a stage called constructor)', () => {
    const ctor = { id: 'constructor', name: 'c', branchPattern: 'main' };
    expect(effectiveBranchPattern(ctor, {}, undefined)).toBe('main');
    expect(
      effectiveBranchPattern(ctor, {}, { branchPatternOverrides: {} }),
    ).toBe('main');
    expect(effectiveBranchPattern(ctor, { constructor: 'x' }, undefined)).toBe(
      'x',
    );
  });
});
