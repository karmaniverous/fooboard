/**
 * Tests for the generated IAM policy (spec.md C-3a): only the read actions
 * the board calls (no `GetJob`), each scoped to the resource AWS supports
 * for it and to the dashboard's apps (once each), and account-wide with no
 * apps.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { amplifyPolicy, policyApps } from './iamPolicy';

const resourceOf = (policy: ReturnType<typeof amplifyPolicy>, action: string) =>
  policy.Statement.find((s) => s.Action.includes(action))?.Resource;

describe('amplifyPolicy', () => {
  const policy = amplifyPolicy([
    { region: 'us-east-1', appId: 'd1' },
    { region: 'eu-west-1', appId: 'd2' },
    { region: 'us-east-1', appId: 'd1' },
  ]);

  it('allows only the read actions the board calls', () => {
    expect(policy.Statement.flatMap((s) => s.Action).sort()).toEqual([
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
  it('reads every app in the account when there are none yet', () => {
    expect(amplifyPolicy([])).toEqual({
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'FooboardListApps',
          Effect: 'Allow',
          Action: ['amplify:ListApps'],
          Resource: '*',
        },
        {
          Sid: 'FooboardReadAllApps',
          Effect: 'Allow',
          Action: ['amplify:ListBranches', 'amplify:ListJobs'],
          Resource: 'arn:aws:amplify:*:*:apps/*',
        },
      ],
    });
  });
});

describe('narrowed policies', () => {
  it('grants only ListApps when the board reads no app with the key', () => {
    expect(amplifyPolicy([], true).Statement.map((s) => s.Sid)).toEqual([
      'FooboardListApps',
    ]);
  });

  it('narrows to the apps when there are some, narrowed or not', () => {
    const apps = [{ region: 'us-east-1', appId: 'd1' }];
    expect(amplifyPolicy(apps, true)).toEqual(amplifyPolicy(apps));
  });
});

describe('policyApps', () => {
  it('keeps each valid app once and counts the invalid ones', () => {
    expect(
      policyApps([
        { region: 'us-east-1', appId: 'd1' },
        { region: 'eu-west-1', appId: 'd2' },
        { region: 'us-east-1', appId: 'd1' },
        { region: 'us-east-1', appId: '*' },
        { region: 'nowhere', appId: 'd3' },
      ]),
    ).toEqual({
      apps: [
        { region: 'us-east-1', appId: 'd1' },
        { region: 'eu-west-1', appId: 'd2' },
      ],
      skipped: 2,
    });
  });
});
