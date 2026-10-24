/**
 * The read-only IAM policy for Amplify rows (spec.md C-3a, C-6): only the
 * actions the board calls, each scoped to the resource it supports (AWS
 * service authorization reference for AWS Amplify):
 * - `ListApps` supports no resource scoping, so it needs `"*"`: the key
 *   can list every app's name in the account (it is how the editor offers
 *   apps to pick);
 * - `ListBranches` is scoped to the app;
 * - `ListJobs` to the app's branches.
 *
 * (`GetJob` is left out: only the Amplify spike page calls it.)
 *
 * The key is usually created before the dashboard has any Amplify rows, so
 * with no apps *Copy AWS policy* copies an account-wide policy: branches
 * and jobs of every Amplify app (`apps/*`, which also matches each app's
 * branches). With apps, it narrows branches and jobs to them.
 *
 * fooboard does not know the apps' account, so the account part of each
 * ARN is `*`: that grants nothing extra, because an IAM user's policy only
 * reaches its own account's Amplify apps (Amplify has no resource-based
 * policies).
 *
 * Regions and app ids are validated before they reach an ARN: an app id of
 * `*` (or one carrying `/` or `:`) would widen the policy to other apps.
 *
 * @module
 */
import { unique } from 'radash';
import { z } from 'zod';

import type { Dashboard } from '@/domain/config/dashboard';

/** The Amplify actions the board calls. */
const AMPLIFY_ACTION = {
  listApps: 'amplify:ListApps',
  listBranches: 'amplify:ListBranches',
  listJobs: 'amplify:ListJobs',
} as const;

/** The policy's statement ids. */
const POLICY_SID = {
  listApps: 'FooboardListApps',
  readBranches: 'FooboardReadBranches',
  readJobs: 'FooboardReadJobs',
  readAllApps: 'FooboardReadAllApps',
} as const;

/** Any resource (all `ListApps` supports). */
const ANY_RESOURCE = '*';

/** Every Amplify app in the key's account, in any region, and (since `*`
 * spans `/`) every app's branches. */
const ANY_APP_ARN = 'arn:aws:amplify:*:*:apps/*';

/** Appended to an app ARN: the app's branches (what `ListJobs` reads). */
const BRANCHES_SUFFIX = '/branches/*';

/** The README template's app ARN, with placeholders to replace. */
const TEMPLATE_APP_ARN = 'arn:aws:amplify:REGION:ACCOUNT_ID:apps/APP_ID';

const POLICY_VERSION = '2012-10-17';

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
  Version: typeof POLICY_VERSION;
  Statement: Statement[];
}

const allow = (
  sid: string,
  actions: string[],
  resource: Statement['Resource'],
): Statement => ({
  Sid: sid,
  Effect: 'Allow',
  Action: actions,
  Resource: resource,
});

/** The policy over app ARNs (`arn:aws:amplify:<region>:<account>:apps/<id>`);
 * with none, branches and jobs of every app in the account. */
function policyOver(appArns: readonly string[]): IamPolicy {
  const arns = unique(appArns);
  const listApps = allow(
    POLICY_SID.listApps,
    [AMPLIFY_ACTION.listApps],
    ANY_RESOURCE,
  );
  return {
    Version: POLICY_VERSION,
    Statement: arns.length
      ? [
          listApps,
          allow(POLICY_SID.readBranches, [AMPLIFY_ACTION.listBranches], arns),
          allow(
            POLICY_SID.readJobs,
            [AMPLIFY_ACTION.listJobs],
            arns.map((arn) => arn + BRANCHES_SUFFIX),
          ),
        ]
      : [
          listApps,
          allow(
            POLICY_SID.readAllApps,
            [AMPLIFY_ACTION.listBranches, AMPLIFY_ACTION.listJobs],
            ANY_APP_ARN,
          ),
        ],
  };
}

/** The policy for `apps` (each validated; an invalid one throws); with
 * none, the account-wide policy. */
export const amplifyPolicy = (apps: readonly PolicyApp[]): IamPolicy =>
  policyOver(
    apps.map((a) => {
      const { region, appId } = PolicyAppSchema.parse(a);
      return `arn:aws:amplify:${region}:*:apps/${appId}`;
    }),
  );

/** The README's account-wide policy: what the button copies before the
 * dashboard has Amplify apps. */
export const accountPolicy = (): IamPolicy => policyOver([]);

/** The README's template: the narrowed policy with placeholders to replace. */
export const policyTemplate = (): IamPolicy => policyOver([TEMPLATE_APP_ARN]);

/** Every Amplify app a dashboard reads (each once), across its rows'
 * pinned apps, and how many pins were skipped for an invalid region or
 * app id. */
export function dashboardApps(dashboard: Dashboard): {
  apps: PolicyApp[];
  skipped: number;
} {
  const sources = dashboard.rows.flatMap((r) =>
    r.type === 'amplify' ? r.pinnedApps : [],
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
