/**
 * Tests for credential resolution (row override beats dashboard default)
 * and for rejecting references to missing or wrong-kind credentials.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { resolveCredentialId } from './credentialRefs';
import { DashboardSchema } from './dashboard';

describe('resolveCredentialId', () => {
  it.each([
    ['the override', { github: 'org-a' }, 'org-b', 'org-b'],
    ['the default', { github: 'org-a' }, undefined, 'org-a'],
    ['nothing', {}, undefined, undefined],
  ])('uses %s', (_label, defaults, override, expected) => {
    expect(resolveCredentialId(defaults, 'github', override)).toBe(expected);
  });
});

const base = {
  id: 'd',
  name: 'D',
  credentials: [
    { id: 'gh', kind: 'github', label: 'GitHub' },
    { id: 'aws', kind: 'aws', label: 'AWS' },
  ],
};
const githubRow = (credentialId?: string) => ({
  type: 'github',
  id: 'r',
  repo: 'acme/api',
  displayName: 'api',
  credentialId,
});

describe('DashboardSchema credential references', () => {
  it('accepts defaults and overrides of the right kind', () => {
    const parsed = DashboardSchema.safeParse({
      ...base,
      defaultCredentials: { github: 'gh', aws: 'aws' },
      rows: [
        githubRow('gh'),
        {
          type: 'amplify',
          id: 'site',
          repo: 'acme/site',
          displayName: 'site',
          sources: [{ region: 'us-east-1', appId: 'a1', credentialId: 'aws' }],
          githubCredentialId: 'gh',
        },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it.each([
    [
      'an unknown default',
      { defaultCredentials: { github: 'nope' } },
      'unknown credential: nope',
    ],
    [
      'a wrong-kind default',
      { defaultCredentials: { aws: 'gh' } },
      'credential gh is github, expected aws',
    ],
    [
      'an unknown row override',
      { rows: [githubRow('nope')] },
      'unknown credential: nope',
    ],
    [
      'a wrong-kind row override',
      { rows: [githubRow('aws')] },
      'credential aws is aws, expected github',
    ],
  ])('rejects %s', (_label, extra, message) => {
    const parsed = DashboardSchema.safeParse({ ...base, ...extra });
    expect(parsed.error?.issues.map((i) => i.message)).toContain(message);
  });
});
