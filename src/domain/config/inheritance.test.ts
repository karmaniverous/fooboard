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
  inheritedCredential,
  inheritedCredentials,
  rowGithubCredentialId,
} from './inheritance';

const frontend = {
  id: 'fe',
  memberIds: ['web'],
  stageRules: {},
  rowRules: {},
  defaultCredentials: { github: 'team' },
  statusSets: {},
};

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
});
