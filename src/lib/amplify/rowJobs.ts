/**
 * Collect the Amplify jobs one row/stage cell is derived from (spec.md
 * §4.3.4): for each of the row's sources (credential + region + app), the
 * app's branches matching the stage pattern, and their newest jobs, each
 * tagged with its source so the cell can link to the right app. Also lists
 * the apps a credential can see across regions, for the row editor
 * (spec.md C-21: apps are picked, not typed).
 *
 * @module
 */
import type { App } from '@aws-sdk/client-amplify';

import type { AmplifySource } from '@/domain/config/row';
import type { AmplifyJobWithBranch } from '@/domain/derivation/types';
import { matchesBranchPattern } from '@/domain/matching/branchPattern';

import { AmplifyNotFoundError } from './errors';
import type { AmplifyReader } from './reader';

/** Supplies the reader for a source's credential and region. */
export type AmplifyReaderFor = (source: {
  credentialId: string;
  region: string;
}) => AmplifyReader;

/** Jobs per matching branch; the cell needs only the newest, a few spare
 * cover a newer-but-undated job. */
const JOBS_PER_BRANCH = 5;

/** The collected jobs and whether any source had a matching branch. */
export interface RowJobs {
  jobsByBranch: AmplifyJobWithBranch[];
  branchExists: boolean;
}

/** Gather the jobs for one Amplify row and one stage's branch pattern. */
export async function collectRowJobs(
  sources: readonly AmplifySource[],
  branchPattern: string,
  readerFor: AmplifyReaderFor,
): Promise<RowJobs> {
  const jobsByBranch: AmplifyJobWithBranch[] = [];
  let branchExists = false;

  for (const source of sources) {
    const reader = readerFor(source);
    const branches = (await reader.listBranches(source.appId))
      .map((b) => b.branchName)
      .filter((name): name is string => name !== undefined)
      .filter((name) => matchesBranchPattern(branchPattern, name));
    branchExists ||= branches.length > 0;

    for (const branch of branches) {
      const jobs = await reader.listJobs(source.appId, branch, JOBS_PER_BRANCH);
      const tag = { region: source.region, appId: source.appId };
      for (const job of jobs) jobsByBranch.push({ source: tag, branch, job });
    }
  }
  return { jobsByBranch, branchExists };
}

/** List the apps one credential can see in each region. A region where
 * Amplify isn't available to the account is skipped; auth errors throw. */
export async function listAppsAcrossRegions(
  credentialId: string,
  regions: readonly string[],
  readerFor: AmplifyReaderFor,
): Promise<{ region: string; app: App }[]> {
  const found: { region: string; app: App }[] = [];
  for (const region of regions) {
    try {
      const apps = await readerFor({ credentialId, region }).listApps();
      for (const app of apps) found.push({ region, app });
    } catch (err) {
      if (!(err instanceof AmplifyNotFoundError)) throw err;
    }
  }
  return found;
}
