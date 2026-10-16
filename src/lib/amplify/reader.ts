/**
 * Amplify read port: the read-only calls fooboard makes (spec.md C-6:
 * `ListApps`, `ListBranches`, `ListJobs`, `GetJob`) behind a narrow
 * interface, plus the AWS SDK adapter that implements it. Every call goes
 * through the credential's serial queue (one request in flight per
 * credential, shared with every region it reads) and is mapped to a typed
 * error. Callers depend on `AmplifyReader`, not on the SDK.
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

import { SerialQueue } from '@/lib/queue/serialQueue';

import { AmplifyThrottledError, toAmplifyError } from './errors';

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
  /** The credential's queue; pass the same one for every region. */
  queue?: SerialQueue;
  /** Defaults to a real `AmplifyClient`. */
  client?: AmplifySender;
}

/** AWS caps one `ListApps`/`ListBranches`/`ListJobs` page at 100 items. */
const PAGE_SIZE = 100;

/** Create an `AmplifyReader` backed by the AWS SDK (SigV4, browser-safe). */
export function createAmplifyReader({
  region,
  accessKeyId,
  secretAccessKey,
  queue = new SerialQueue(),
  client = new AmplifyClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  }),
}: AmplifyReaderConfig): AmplifyReader {
  const call = <T>(operation: string, task: () => Promise<T>): Promise<T> =>
    queue.enqueue(async () => {
      try {
        return await task();
      } catch (err) {
        const mapped = toAmplifyError(err, operation);
        if (mapped instanceof AmplifyThrottledError) {
          queue.pauseUntil(Date.now() + mapped.retryAfterMs);
        }
        throw mapped;
      }
    });

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
