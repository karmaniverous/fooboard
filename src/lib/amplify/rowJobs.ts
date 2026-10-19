/**
 * Read Amplify jobs (spec.md §4.3.4, A§4.3.7): for an app (credential +
 * region + app id), the branches its source rule's branch rule chooses,
 * and each one's newest jobs, tagged with the app so a cell can link to
 * it. Also lists
 * the apps a credential can see across regions, for the row editor
 * (spec.md C-21: apps are picked, not typed).
 *
 * @module
 */
import type { App, Branch, JobSummary } from '@aws-sdk/client-amplify';

import type { AmplifySource } from '@/domain/config/row';
import type { AmplifyJobWithBranch } from '@/domain/derivation/types';
import { asJson } from '@/domain/model/json';
import { evaluateRule } from '@/domain/rules/check';
import type { Rule } from '@/domain/rules/schema';

import { AmplifyNotFoundError } from './errors';
import type { AmplifyReader } from './reader';

/** A source with its credential resolved (override or dashboard default). */
export type ResolvedAmplifySource = Omit<AmplifySource, 'credentialId'> & {
  credentialId: string;
};

/** An app's identity on the board: who reads it, where. */
export const appKey = (s: ResolvedAmplifySource): string =>
  JSON.stringify([s.credentialId, s.region, s.appId]);

/** Supplies the reader for a source's credential and region. */
export type AmplifyReaderFor = (source: {
  credentialId: string;
  region: string;
}) => AmplifyReader;

/** Wrap `readerFor` so each source's branch list and each branch's jobs
 * are read once, however many stages ask (use one per row refresh). */
export function memoizeReaderFor(
  readerFor: AmplifyReaderFor,
): AmplifyReaderFor {
  // One cache per result type, so no cached promise needs narrowing.
  const branchCalls = new Map<string, Promise<Branch[]>>();
  const jobCalls = new Map<string, Promise<JobSummary[]>>();
  const once = <T>(
    calls: Map<string, Promise<T>>,
    key: string,
    call: () => Promise<T>,
  ): Promise<T> => {
    let pending = calls.get(key);
    if (!pending) {
      pending = call();
      calls.set(key, pending);
    }
    return pending;
  };
  return (source) => {
    const reader = readerFor(source);
    const scope = `${source.credentialId}|${source.region}`;
    return {
      ...reader,
      listBranches: (appId) =>
        once(branchCalls, `${scope}|branches|${appId}`, () =>
          reader.listBranches(appId),
        ),
      listJobs: (appId, branch, max) =>
        once(jobCalls, `${scope}|jobs|${appId}|${branch}|${String(max)}`, () =>
          reader.listJobs(appId, branch, max),
        ),
    };
  };
}

/** What the Amplify reader asks for (the source rule's reader options). */
export interface AmplifyReadOptions {
  jobsPerBranch: number;
  branches: Rule;
}

const ALL_BRANCHES: AmplifyReadOptions = {
  jobsPerBranch: 20,
  branches: { combine: 'and', checks: [] },
};

/** One app's read: the jobs of the branches the branch rule chose, the
 * whole branch list (for the branch rule's sample), and whether any
 * branch's read came back full (as many jobs as asked for). */
export interface AppRead {
  jobs: AmplifyJobWithBranch[];
  branches: Branch[];
  full: boolean;
}

/** Read one app (spec.md A§4.3.7): its branch list, then the jobs of
 * each branch the branch rule chooses. */
export async function readAppJobs(
  source: ResolvedAmplifySource,
  readerFor: AmplifyReaderFor,
  options: AmplifyReadOptions = ALL_BRANCHES,
): Promise<AppRead> {
  const reader = readerFor(source);
  const branches = await reader.listBranches(source.appId);
  const chosen = branches
    .filter((b) => evaluateRule(options.branches, asJson(b)))
    .map((b) => b.branchName)
    .filter((name): name is string => name !== undefined);
  const tag = { region: source.region, appId: source.appId };
  const jobs: AmplifyJobWithBranch[] = [];
  let full = false;
  for (const branch of chosen) {
    const found = await reader.listJobs(
      source.appId,
      branch,
      options.jobsPerBranch,
    );
    full ||= found.length >= options.jobsPerBranch;
    for (const job of found) jobs.push({ source: tag, branch, job });
  }
  return { jobs, branches, full };
}

/** Gather the jobs of every app of one Amplify row. */
export async function collectRowJobs(
  sources: readonly ResolvedAmplifySource[],
  readerFor: AmplifyReaderFor,
  options: AmplifyReadOptions = ALL_BRANCHES,
): Promise<AmplifyJobWithBranch[]> {
  const jobs: AmplifyJobWithBranch[] = [];
  for (const source of sources)
    jobs.push(...(await readAppJobs(source, readerFor, options)).jobs);
  return jobs;
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
