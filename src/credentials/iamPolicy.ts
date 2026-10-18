/**
 * The read-only IAM policy for Amplify rows (spec.md C-3a, C-6), split by
 * the resource each action supports (AWS service authorization reference
 * for AWS Amplify):
 * - `ListApps` supports no resource scoping, so it needs `"*"`: the key
 *   can list every app's name in the account (it is how the editor offers
 *   apps to pick);
 * - `ListBranches` is scoped to the app;
 * - `ListJobs` to the app's branches;
 * - `GetJob` to the jobs on those branches.
 *
 * *Copy AWS policy* fills in a dashboard's apps. fooboard does not know
 * their account, so the account part of each ARN is `*`: that grants
 * nothing extra, because an IAM user's policy only reaches its own
 * account's Amplify apps (Amplify has no resource-based policies).
 *
 * @module
 */
import { unique } from 'radash';

import type { Dashboard } from '@/domain/config/dashboard';

/** One Amplify app the key must read. */
export interface PolicyApp {
  region: string;
  appId: string;
}

interface Statement {
  Sid: string;
  Effect: 'Allow';
  Action: string[];
  Resource: string | string[];
}

export interface IamPolicy {
  Version: '2012-10-17';
  Statement: Statement[];
}

/** The policy for `apps`; with none, only `ListApps` (for picking apps). */
export function amplifyPolicy(
  apps: readonly PolicyApp[],
  account = '*',
): IamPolicy {
  const arns = unique(
    apps.map((a) => `arn:aws:amplify:${a.region}:${account}:apps/${a.appId}`),
  );
  const read = (sid: string, action: string, suffix: string): Statement => ({
    Sid: sid,
    Effect: 'Allow',
    Action: [`amplify:${action}`],
    Resource: arns.map((arn) => arn + suffix),
  });
  return {
    Version: '2012-10-17',
    Statement: [
      {
        Sid: 'FooboardListApps',
        Effect: 'Allow',
        Action: ['amplify:ListApps'],
        Resource: '*',
      },
      ...(arns.length
        ? [
            read('FooboardReadBranches', 'ListBranches', ''),
            read('FooboardReadJobs', 'ListJobs', '/branches/*'),
            read('FooboardReadJob', 'GetJob', '/branches/*/jobs/*'),
          ]
        : []),
    ],
  };
}

/** Every Amplify app a dashboard reads, across its rows' sources. */
export const dashboardApps = (dashboard: Dashboard): PolicyApp[] =>
  dashboard.rows.flatMap((r) =>
    r.type === 'amplify'
      ? r.sources.map(({ region, appId }) => ({ region, appId }))
      : [],
  );
