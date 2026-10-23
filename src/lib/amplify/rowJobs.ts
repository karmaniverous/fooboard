/**
 * Amplify reads (spec.md §2.3, §3.1): an app's identity on the board
 * (credential + region + app id), the branches its source rule's branch
 * rule chooses (each one a jobs query), and the apps a credential can see
 * across regions, for the row editor (spec.md C-21: apps are picked, not
 * typed).
 *
 * @module
 */
import type { App, Branch } from '@aws-sdk/client-amplify';

import type { AmplifySource } from '@/domain/config/row';
import { asJson } from '@/domain/model/json';
import type { AmplifyReaderOptions } from '@/domain/model/sourceRule';
import { evaluateRule } from '@/domain/rules/check';

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

/** The branches of `branches` the branch rule chooses, by name. */
export const chosenBranches = (
  branches: readonly Branch[],
  options: Pick<AmplifyReaderOptions, 'branches'>,
): string[] =>
  branches
    .filter((b) => evaluateRule(options.branches, asJson(b)))
    .map((b) => b.branchName)
    .filter((name): name is string => name !== undefined);

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
