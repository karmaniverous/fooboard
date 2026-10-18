/**
 * Tests for the generated IAM policy (spec.md C-3a): only the read actions
 * fooboard uses, each scoped to the resource AWS supports for it and to
 * the dashboard's apps (once each), and only `ListApps` with no apps.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';

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

  it('fills in an account when given one (the README template)', () => {
    expect(
      resourceOf(
        amplifyPolicy([{ region: 'REGION', appId: 'APP_ID' }], 'ACCOUNT_ID'),
        'amplify:ListBranches',
      ),
    ).toEqual(['arn:aws:amplify:REGION:ACCOUNT_ID:apps/APP_ID']);
  });

  it('allows only listing apps when there are none yet', () => {
    expect(amplifyPolicy([]).Statement.flatMap((s) => s.Action)).toEqual([
      'amplify:ListApps',
    ]);
  });
});

describe('dashboardApps', () => {
  it("collects every Amplify source's region and app, skipping GitHub rows", () => {
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
          ],
        },
      ],
      stages: [{ id: 'dev', name: 'dev', branchPattern: 'dev' }],
    });
    expect(dashboardApps(dashboard)).toEqual([
      { region: 'us-east-1', appId: 'd1' },
      { region: 'eu-west-1', appId: 'd2' },
    ]);
  });
});
