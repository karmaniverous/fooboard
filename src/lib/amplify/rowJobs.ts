/**
 * Amplify reads (spec.md §2.3, §3.1): an app's identity on the board
 * (credential + region + app id), the branches its source rule's branch
 * rule chooses (each one a jobs query). The apps a credential can see
 * across regions, for the row editor, are listed in `regions`.
 *
 * @module
 */
import type { Branch } from '@aws-sdk/client-amplify';

import type { PinnedApp } from '@/domain/config/row';
import { asJson } from '@/domain/model/json';
import type { AmplifyReaderOptions } from '@/domain/model/sourceRule';
import { evaluateRule } from '@/domain/rules/check';

import type { AmplifyReader } from './reader';

/** A pinned app with the AWS key a cell reads it with. */
export type ResolvedAmplifySource = Omit<PinnedApp, 'credentialId'> & {
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
