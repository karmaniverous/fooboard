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

/** Gather the jobs for one Amplify row and one stage's branch pattern. */
export async function collectRowJobs(
  sources: readonly ResolvedAmplifySource[],
  readerFor: AmplifyReaderFor,
  options: { jobsPerBranch: number; branches: Rule } = {
    jobsPerBranch: 20,
    branches: { combine: 'and', checks: [] },
  },
): Promise<AmplifyJobWithBranch[]> {
  const jobsByBranch: AmplifyJobWithBranch[] = [];

  for (const source of sources) {
    const reader = readerFor(source);
    const branches = (await reader.listBranches(source.appId))
      .filter((b) => evaluateRule(options.branches, asJson(b)))
      .map((b) => b.branchName)
      .filter((name): name is string => name !== undefined);

    for (const branch of branches) {
      const jobs = await reader.listJobs(
        source.appId,
        branch,
        options.jobsPerBranch,
      );
      const tag = { region: source.region, appId: source.appId };
      for (const job of jobs) jobsByBranch.push({ source: tag, branch, job });
    }
  }
  return jobsByBranch;
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
