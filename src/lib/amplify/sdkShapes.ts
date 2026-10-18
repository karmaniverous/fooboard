/**
 * Complete Amplify SDK shapes from the few fields a caller has (the demo
 * provider, test fixtures). The SDK's required members all accept
 * `undefined`, so each builder starts from every one of them unset and
 * applies the given fields: fully typed, no assertion.
 *
 * @module
 */
import type { App, Branch, Job, JobSummary } from '@aws-sdk/client-amplify';

export const amplifyApp = (fields: Partial<App>): App => ({
  appId: undefined,
  appArn: undefined,
  name: undefined,
  description: undefined,
  repository: undefined,
  platform: undefined,
  createTime: undefined,
  updateTime: undefined,
  environmentVariables: undefined,
  defaultDomain: undefined,
  enableBranchAutoBuild: undefined,
  enableBasicAuth: undefined,
  ...fields,
});

export const amplifyBranch = (fields: Partial<Branch>): Branch => ({
  branchArn: undefined,
  branchName: undefined,
  description: undefined,
  stage: undefined,
  displayName: undefined,
  enableNotification: undefined,
  createTime: undefined,
  updateTime: undefined,
  environmentVariables: undefined,
  enableAutoBuild: undefined,
  customDomains: undefined,
  framework: undefined,
  activeJobId: undefined,
  totalNumberOfJobs: undefined,
  enableBasicAuth: undefined,
  ttl: undefined,
  enablePullRequestPreview: undefined,
  ...fields,
});

export const amplifyJobSummary = (fields: Partial<JobSummary>): JobSummary => ({
  jobArn: undefined,
  jobId: undefined,
  commitId: undefined,
  commitMessage: undefined,
  commitTime: undefined,
  startTime: undefined,
  status: undefined,
  jobType: undefined,
  ...fields,
});

export const amplifyJob = (fields: Partial<Job>): Job => ({
  summary: undefined,
  steps: undefined,
  ...fields,
});
