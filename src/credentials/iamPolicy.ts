/**
 * The read-only IAM policy for Amplify rows (spec.md C-6, C-3a), split by
 * the resource each action supports (AWS service authorization reference
 * for AWS Amplify):
 * - `ListApps` supports no resource scoping, so it needs `"*"`: the key
 *   can list every app's name in the account;
 * - `ListBranches` is scoped to the app;
 * - `ListJobs` to the app's branches;
 * - `GetJob` to the jobs on those branches.
 *
 * @module
 */

/** The example policy shown in the guide; replace region, account and app. */
export const IAM_POLICY = {
  Version: '2012-10-17',
  Statement: [
    {
      Sid: 'FooboardListApps',
      Effect: 'Allow',
      Action: ['amplify:ListApps'],
      Resource: '*',
    },
    {
      Sid: 'FooboardReadBranches',
      Effect: 'Allow',
      Action: ['amplify:ListBranches'],
      Resource: ['arn:aws:amplify:us-east-1:123456789012:apps/d2x8k1'],
    },
    {
      Sid: 'FooboardReadJobs',
      Effect: 'Allow',
      Action: ['amplify:ListJobs'],
      Resource: [
        'arn:aws:amplify:us-east-1:123456789012:apps/d2x8k1/branches/*',
      ],
    },
    {
      Sid: 'FooboardReadJob',
      Effect: 'Allow',
      Action: ['amplify:GetJob'],
      Resource: [
        'arn:aws:amplify:us-east-1:123456789012:apps/d2x8k1/branches/*/jobs/*',
      ],
    },
  ],
} as const;
