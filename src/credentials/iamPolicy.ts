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
 * Regions and app ids are validated before they reach an ARN: an app id of
 * `*` (or one carrying `/` or `:`) would widen the policy to other apps.
 *
 * @module
 */
import { unique } from 'radash';
import { z } from 'zod';

import type { Dashboard } from '@/domain/config/dashboard';

/** One Amplify app the key must read: an AWS region (`us-east-1`,
 * `us-gov-west-1`) and an Amplify app id (`d` and up to 19 lowercase
 * letters or digits, as the Amplify API defines it). */
const PolicyAppSchema = z.object({
  region: z.string().regex(/^[a-z]{2}(-[a-z]+)+-\d{1,2}$/),
  appId: z.string().regex(/^d[a-z0-9]{1,19}$/),
});
export type PolicyApp = z.infer<typeof PolicyAppSchema>;

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

/** The policy over app ARNs (`arn:aws:amplify:<region>:<account>:apps/<id>`);
 * with none, only `ListApps`. */
function policyOver(appArns: readonly string[]): IamPolicy {
  const arns = unique(appArns);
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

/** The policy for `apps` (each validated; an invalid one throws). */
export const amplifyPolicy = (apps: readonly PolicyApp[]): IamPolicy =>
  policyOver(
    apps.map((a) => {
      const { region, appId } = PolicyAppSchema.parse(a);
      return `arn:aws:amplify:${region}:*:apps/${appId}`;
    }),
  );

/** The README's template: the policy with placeholders to replace. */
export const policyTemplate = (): IamPolicy =>
  policyOver(['arn:aws:amplify:REGION:ACCOUNT_ID:apps/APP_ID']);

/** Every Amplify app a dashboard reads (each once), across its rows'
 * sources, and how many sources were skipped for an invalid region or app
 * id. */
export function dashboardApps(dashboard: Dashboard): {
  apps: PolicyApp[];
  skipped: number;
} {
  const sources = dashboard.rows.flatMap((r) =>
    r.type === 'amplify' ? r.sources : [],
  );
  const valid = sources.flatMap((s) => {
    const app = PolicyAppSchema.safeParse(s);
    return app.success ? [app.data] : [];
  });
  return {
    apps: unique(valid, (a) => `${a.region}/${a.appId}`),
    skipped: sources.length - valid.length,
  };
}
