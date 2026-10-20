/**
 * Tests for the generated IAM policy (spec.md C-3a): only the read actions
 * fooboard uses, each scoped to the resource AWS supports for it and to
 * the dashboard's apps (once each), and only `ListApps` with no apps.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';

import { amplifyPolicy, dashboardApps } from './iamPolicy';

const resourceOf = (policy: ReturnType<typeof amplifyPolicy>, action: string) =>
  policy.Statement.find((s) => s.Action.includes(action))?.Resource;

describe('amplifyPolicy', () => {
  const policy = amplifyPolicy([
    { region: 'us-east-1', appId: 'd1' },
    { region: 'eu-west-1', appId: 'd2' },
    { region: 'us-east-1', appId: 'd1' },
  ]);

  it('allows only the read actions fooboard uses', () => {
    expect(policy.Statement.flatMap((s) => s.Action).sort()).toEqual([
      'amplify:GetJob',
      'amplify:ListApps',
      'amplify:ListBranches',
      'amplify:ListJobs',
    ]);
    expect(new Set(policy.Statement.map((s) => s.Effect))).toEqual(
      new Set(['Allow']),
    );
  });

  it('scopes each action to its resource type, for each app once', () => {
    expect(resourceOf(policy, 'amplify:ListApps')).toBe('*');
    expect(resourceOf(policy, 'amplify:ListBranches')).toEqual([
      'arn:aws:amplify:us-east-1:*:apps/d1',
      'arn:aws:amplify:eu-west-1:*:apps/d2',
    ]);
    expect(resourceOf(policy, 'amplify:ListJobs')).toEqual([
      'arn:aws:amplify:us-east-1:*:apps/d1/branches/*',
      'arn:aws:amplify:eu-west-1:*:apps/d2/branches/*',
    ]);
    expect(resourceOf(policy, 'amplify:GetJob')).toEqual([
      'arn:aws:amplify:us-east-1:*:apps/d1/branches/*/jobs/*',
      'arn:aws:amplify:eu-west-1:*:apps/d2/branches/*/jobs/*',
    ]);
  });

  it.each([
    ['an app id wildcard', { region: 'us-east-1', appId: '*' }],
    ['an app id with a path', { region: 'us-east-1', appId: 'd1/branches' }],
    ['an app id with an ARN separator', { region: 'us-east-1', appId: 'd1:x' }],
    ['an app id not starting with d', { region: 'us-east-1', appId: 'x1' }],
    ['a region wildcard', { region: '*', appId: 'd1' }],
    ['a region with a separator', { region: 'us-east-1:*', appId: 'd1' }],
  ])('refuses %s, which would widen the policy', (_, app) => {
    expect(() => amplifyPolicy([app])).toThrow();
  });
  it('allows only listing apps when there are none yet', () => {
    expect(amplifyPolicy([]).Statement.flatMap((s) => s.Action)).toEqual([
      'amplify:ListApps',
    ]);
  });
});

describe('dashboardApps', () => {
  it('collects each Amplify app once, skipping GitHub rows and invalid sources', () => {
    const dashboard = DashboardSchema.parse({
      id: 'd',
      name: 'd',
      credentials: [{ id: 'k', kind: 'aws', label: 'k' }],
      rows: [
        { type: 'github', id: 'api', repo: 'acme/api', displayName: 'api' },
        {
          type: 'amplify',
          id: 'web',
          displayName: 'web',
          repo: 'acme/web',
          sources: [
            { region: 'us-east-1', appId: 'd1' },
            { region: 'eu-west-1', appId: 'd2', credentialId: 'k' },
            { region: 'us-east-1', appId: 'd1' },
            { region: 'us-east-1', appId: '*' },
          ],
        },
      ],
      stages: [{ id: 'dev', name: 'dev', rules: branchRules('dev') }],
    });
    expect(dashboardApps(dashboard)).toEqual({
      apps: [
        { region: 'us-east-1', appId: 'd1' },
        { region: 'eu-west-1', appId: 'd2' },
      ],
      skipped: 1,
    });
  });
});
