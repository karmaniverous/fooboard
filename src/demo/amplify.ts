/**
 * Demo Amplify provider (spec.md C-23): an `AmplifyReaderFor` answering
 * from the demo scenarios for the demo AWS account's apps, so Amplify rows
 * run through the real job collection and derivation code. The partner
 * portal has two sources; its EU app's jobs are older, so the US app wins.
 *
 * @module
 */
import type {
  App,
  Branch,
  JobStatus,
  JobSummary,
} from '@aws-sdk/client-amplify';

import type { AmplifyReader } from '@/lib/amplify/reader';
import type { AmplifyReaderFor } from '@/lib/amplify/rowJobs';

import { DEMO_AMPLIFY_APPS, DEMO_STAGE_IDS } from './board';
import {
  type DemoJobState,
  jobStates,
  MINUTE,
  scenarioFor,
  stageBranch,
} from './scenarios';

const AMPLIFY_STATUS: Record<DemoJobState, JobStatus> = {
  waiting: 'PENDING',
  queued: 'PENDING',
  running: 'RUNNING',
  success: 'SUCCEED',
  failure: 'FAILED',
  cancelled: 'CANCELLED',
};

/** The demo row an app id belongs to, and that source's position. */
function appOwner(appId: string): { row: string; index: number } | undefined {
  for (const [row, sources] of Object.entries(DEMO_AMPLIFY_APPS)) {
    const index = sources.findIndex((s) => s.appId === appId);
    if (index >= 0) return { row, index };
  }
  return undefined;
}

/** Create the demo `AmplifyReaderFor`; `clock` drives scenario progress. */
export function createDemoAmplifyReaderFor(
  clock: () => number = Date.now,
): AmplifyReaderFor {
  const startMs = clock();

  const readerFor = (region: string): AmplifyReader => ({
    listApps: () =>
      Promise.resolve(
        Object.entries(DEMO_AMPLIFY_APPS).flatMap(([row, sources]) =>
          sources
            .filter((s) => s.region === region)
            .map((s) => ({ appId: s.appId, name: row }) as App),
        ),
      ),
    listBranches: (appId) => {
      const owner = appOwner(appId);
      if (!owner) return Promise.resolve([]);
      return Promise.resolve(
        DEMO_STAGE_IDS.filter(
          (id) => scenarioFor(owner.row, id) !== 'noBranch',
        ).map((id) => ({ branchName: stageBranch(id) }) as Branch),
      );
    },
    listJobs: (appId, branchName) => {
      const owner = appOwner(appId);
      const s = DEMO_STAGE_IDS.findIndex(
        (id) => stageBranch(id) === branchName,
      );
      if (!owner || s < 0) return Promise.resolve([]);
      const scenario = scenarioFor(owner.row, DEMO_STAGE_IDS[s] ?? '');
      if (scenario === 'noRuns') return Promise.resolve([]);
      const live = scenario === 'started' || scenario === 'queued';
      // Older sources (higher index) started earlier, so the first wins.
      const startTime =
        startMs - (live ? 1 : (s + 1) * 41 + owner.index * 90) * MINUTE;
      // Amplify has one job per deploy: a failing scenario fails the deploy.
      const state =
        scenario === 'failure'
          ? 'failure'
          : jobStates(scenario, clock() - startMs).deploy;
      const job: JobSummary = {
        jobId: String(100 + s * 10 + owner.index),
        jobArn: `arn:aws:amplify:${region}:000000000000:apps/${appId}/branches/${branchName}/jobs/1`,
        commitId: `${appId.slice(-4)}${String(s)}c0ffee`,
        commitMessage: 'Demo deploy',
        commitTime: new Date(startTime),
        startTime: new Date(startTime),
        status: AMPLIFY_STATUS[state],
        jobType: 'RELEASE',
        endTime:
          state === 'success' || state === 'failure' || state === 'cancelled'
            ? new Date(startTime + 4 * MINUTE)
            : undefined,
      };
      return Promise.resolve([job]);
    },
    getJob: () => Promise.resolve(undefined),
  });

  return ({ region }) => readerFor(region);
}
