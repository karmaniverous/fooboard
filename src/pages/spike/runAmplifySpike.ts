/**
 * Amplify spike orchestration (spec.md §6 spike 1): `ListBranches` →
 * `ListJobs` (5) → `GetJob` on the newest job, then the console link. Pure
 * apart from the injected `AmplifyReader`, so it is tested with a fake.
 *
 * @module
 */
import type { Branch, Job, JobSummary } from '@aws-sdk/client-amplify';

import { buildAmplifyConsoleLink } from '@/lib/amplify/consoleLink';
import { newestJob } from '@/lib/amplify/newestJob';
import type { AmplifyReader } from '@/lib/amplify/reader';

/** What the spike needs besides credentials. */
export interface AmplifySpikeTarget {
  region: string;
  appId: string;
  /** Branch to inspect; the app's first branch when omitted or blank. */
  branch?: string;
}

/** Everything the spike page shows. */
export interface AmplifySpikeResult {
  branches: Branch[];
  jobs: JobSummary[];
  job: Job | undefined;
  consoleLink: string;
}

/** Run the spike's read chain against one Amplify app. */
export async function runAmplifySpike(
  reader: AmplifyReader,
  { region, appId, branch }: AmplifySpikeTarget,
): Promise<AmplifySpikeResult> {
  const branches = await reader.listBranches(appId);
  const branchName = branch || branches[0]?.branchName;
  if (!branchName) {
    throw new Error('No branch found on this app, and none was given.');
  }

  const jobs = await reader.listJobs(appId, branchName, 5);
  const jobId = newestJob(jobs)?.jobId;
  if (!jobId) throw new Error(`No jobs found on branch "${branchName}".`);

  return {
    branches,
    jobs,
    job: await reader.getJob(appId, branchName, jobId),
    consoleLink: buildAmplifyConsoleLink({
      region,
      appId,
      branch: branchName,
      jobId,
    }),
  };
}
