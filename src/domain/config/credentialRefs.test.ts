/**
 * Tests for rejecting credential references to missing or wrong-kind
 * credentials, at every settings level and on pinned apps, each at its
 * path.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from './dashboard';

const base = {
  id: 'd',
  name: 'D',
  credentials: [
    { id: 'gh', kind: 'github', label: 'GitHub' },
    { id: 'aws', kind: 'aws', label: 'AWS' },
  ],
  stages: [{ id: 'dev', name: 'dev' }],
};
const githubRow = (githubToken?: string) => ({
  type: 'github',
  id: 'r',
  repo: 'acme/api',
  displayName: 'api',
  settings: githubToken ? { githubToken } : {},
});
const amplifyRow = (pinKey: string) => ({
  type: 'amplify',
  id: 'site',
  displayName: 'site',
  pinnedApps: [{ region: 'us-east-1', appId: 'a1', credentialId: pinKey }],
});

describe('DashboardSchema credential references', () => {
  it('accepts settings and pins of the right kind', () => {
    const parsed = DashboardSchema.safeParse({
      ...base,
      settings: { githubToken: 'gh', awsKey: 'aws' },
      rows: [
        githubRow('gh'),
        {
          ...amplifyRow('aws'),
          repo: 'acme/site',
          settings: { githubToken: 'gh', awsKey: 'aws' },
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it.each([
    [
      'an unknown dashboard setting',
      { settings: { githubToken: 'nope' } },
      'unknown credential: nope',
      ['settings', 'githubToken'],
    ],
    [
      'a wrong-kind dashboard setting',
      { settings: { awsKey: 'gh' } },
      'credential gh is github, expected aws',
      ['settings', 'awsKey'],
    ],
    [
      'an unknown row setting',
      { rows: [githubRow('nope')] },
      'unknown credential: nope',
      ['rows', 0, 'settings', 'githubToken'],
    ],
    [
      'a wrong-kind row setting',
      { rows: [githubRow('aws')] },
      'credential aws is aws, expected github',
      ['rows', 0, 'settings', 'githubToken'],
    ],
    [
      'a wrong-kind row-group setting',
      {
        rows: [githubRow()],
        rowGroups: [
          { id: 'g', memberIds: ['r'], settings: { githubToken: 'aws' } },
        ],
      },
      'credential aws is aws, expected github',
      ['rowGroups', 0, 'settings', 'githubToken'],
    ],
    [
      'a wrong-kind column-group setting',
      {
        columnGroups: [
          { id: 'cg', memberIds: ['dev'], settings: { awsKey: 'gh' } },
        ],
      },
      'credential gh is github, expected aws',
      ['columnGroups', 0, 'settings', 'awsKey'],
    ],
    [
      'an unknown column setting',
      { stages: [{ id: 'dev', name: 'dev', settings: { awsKey: 'nope' } }] },
      'unknown credential: nope',
      ['stages', 0, 'settings', 'awsKey'],
    ],
    [
      'a wrong-kind cell setting',
      {
        rows: [
          { ...githubRow(), cellSettings: { dev: { githubToken: 'aws' } } },
        ],
      },
      'credential aws is aws, expected github',
      ['rows', 0, 'cellSettings', 'dev', 'githubToken'],
    ],
    [
      "a wrong-kind pin's key",
      { rows: [amplifyRow('gh')] },
      'credential gh is github, expected aws',
      ['rows', 0, 'pinnedApps', 0, 'credentialId'],
    ],
  ])('rejects %s at its path', (_label, extra, message, path) => {
    const parsed = DashboardSchema.safeParse({ ...base, ...extra });
    expect(
      parsed.error?.issues.map((i) => ({ message: i.message, path: i.path })),
    ).toContainEqual({ message, path });
  });
});
