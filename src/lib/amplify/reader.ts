/**
 * Amplify read port: the read-only calls fooboard makes (spec.md C-6:
 * `ListApps`, `ListBranches`, `ListJobs`, `GetJob`) behind a narrow
 * interface, plus the AWS SDK adapter that implements it. Every call is
 * mapped to a typed error; the SDK makes one attempt (`maxAttempts: 1`), so
 * retries and throttling follow the query layer's policy and limiter
 * (spec.md §3.1). Callers depend on `AmplifyReader`, not on the SDK.
 *
 * @module
 */
import {
  AmplifyClient,
  type App,
  type Branch,
  GetJobCommand,
  type Job,
  type JobSummary,
  ListAppsCommand,
  ListBranchesCommand,
  ListJobsCommand,
} from '@aws-sdk/client-amplify';

import { toAmplifyError } from './errors';

/** Read-only access to one AWS account's Amplify apps in one region. */
export interface AmplifyReader {
  listApps(): Promise<App[]>;
  listBranches(appId: string): Promise<Branch[]>;
  /** Newest jobs first, up to `maxResults`, following pages as needed. */
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

/** The slice of `AmplifyClient` the reader uses (injectable for tests). */
export interface AmplifySender {
  send: AmplifyClient['send'];
}

/** Credentials, region and optional collaborators for an Amplify reader. */
export interface AmplifyReaderConfig {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Defaults to a real `AmplifyClient`. */
  client?: AmplifySender;
}

/** Page size valid for all three list calls: `ListBranches` and `ListJobs`
 * accept at most 50 (`ListApps` allows 100). */
const PAGE_SIZE = 50;

/** The SDK's attempts per call (spec.md §3.1): one, so its own retries
 * (up to 3 by default, with their own back-off) never hold a limiter slot
 * or bypass the query layer's retry policy. */
const AMPLIFY_MAX_ATTEMPTS = 1;

/** Create an `AmplifyReader` backed by the AWS SDK (SigV4, browser-safe). */
export function createAmplifyReader({
  region,
  accessKeyId,
  secretAccessKey,
  client = new AmplifyClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
    maxAttempts: AMPLIFY_MAX_ATTEMPTS,
  }),
}: AmplifyReaderConfig): AmplifyReader {
  const call = async <T>(
    operation: string,
    task: () => Promise<T>,
  ): Promise<T> => {
    try {
      return await task();
    } catch (err) {
      throw toAmplifyError(err, operation);
    }
  };

  /** Follow `nextToken` until `limit` items or the last page. */
  async function paged<T>(
    operation: string,
    fetchPage: (nextToken?: string) => Promise<{ items?: T[]; next?: string }>,
    limit = Infinity,
  ): Promise<T[]> {
    const items: T[] = [];
    let next: string | undefined;
    do {
      const token = next;
      const page = await call(operation, () => fetchPage(token));
      items.push(...(page.items ?? []));
      next = page.next;
    } while (next && items.length < limit);
    return items.slice(0, limit);
  }

  return {
    listApps: () =>
      paged('ListApps', async (nextToken) => {
        const res = await client.send(
          new ListAppsCommand({ maxResults: PAGE_SIZE, nextToken }),
        );
        return { items: res.apps, next: res.nextToken };
      }),
    listBranches: (appId) =>
      paged('ListBranches', async (nextToken) => {
        const res = await client.send(
          new ListBranchesCommand({ appId, maxResults: PAGE_SIZE, nextToken }),
        );
        return { items: res.branches, next: res.nextToken };
      }),
    listJobs: (appId, branchName, maxResults) =>
      paged(
        'ListJobs',
        async (nextToken) => {
          const res = await client.send(
            new ListJobsCommand({
              appId,
              branchName,
              maxResults: Math.min(maxResults, PAGE_SIZE),
              nextToken,
            }),
          );
          return { items: res.jobSummaries, next: res.nextToken };
        },
        maxResults,
      ),
    getJob: (appId, branchName, jobId) =>
      call('GetJob', async () => {
        const res = await client.send(
          new GetJobCommand({ appId, branchName, jobId }),
        );
        return res.job;
      }),
  };
}
