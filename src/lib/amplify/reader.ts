/**
 * Amplify read port: the three read-only calls fooboard makes (spec.md C-6:
 * `ListBranches`, `ListJobs`, `GetJob`) behind a narrow interface, plus the
 * AWS SDK adapter that implements it. Callers depend on `AmplifyReader`, not
 * on the SDK, so they can be tested with a plain fake.
 *
 * @module
 */
import {
  AmplifyClient,
  type Branch,
  GetJobCommand,
  type Job,
  type JobSummary,
  ListBranchesCommand,
  ListJobsCommand,
} from '@aws-sdk/client-amplify';

/** Read-only access to one AWS account's Amplify apps in one region. */
export interface AmplifyReader {
  listBranches(appId: string): Promise<Branch[]>;
  listJobs(
    appId: string,
    branchName: string,
    maxResults: number,
  ): Promise<JobSummary[]>;
  getJob(
    appId: string,
    branchName: string,
    jobId: string,
  ): Promise<Job | undefined>;
}

/** Credentials and region for an Amplify reader. */
export interface AmplifyReaderConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/** Create an `AmplifyReader` backed by the AWS SDK (SigV4, browser-safe). */
export function createAmplifyReader({
  region,
  accessKeyId,
  secretAccessKey,
}: AmplifyReaderConfig): AmplifyReader {
  const client = new AmplifyClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  return {
    async listBranches(appId) {
      const res = await client.send(new ListBranchesCommand({ appId }));
      return res.branches ?? [];
    },
    async listJobs(appId, branchName, maxResults) {
      const res = await client.send(
        new ListJobsCommand({ appId, branchName, maxResults }),
      );
      return res.jobSummaries ?? [];
    },
    async getJob(appId, branchName, jobId) {
      const res = await client.send(
        new GetJobCommand({ appId, branchName, jobId }),
      );
      return res.job;
    },
  };
}
