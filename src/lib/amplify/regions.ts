/**
 * The regions the app search and the Amplify app picker list (spec.md
 * §3.1 *Amplify regions*, §3.12 *The search*, Decisions 21, 29, 54 and
 * 56): every AWS region with Amplify Hosting, a named list updated by
 * release, one `ListApps` per region, and the skip rules: a region where
 * Amplify isn't available to the account, or that the account can't see,
 * is skipped rather than failing the listing, since it can hold none of
 * the account's apps that fooboard could read; an opt-in region that
 * doesn't answer within `OPT_IN_REGION_TIMEOUT_MS` is cancelled and
 * skipped as unreachable (Q33).
 *
 * @module
 */
import type { App } from '@aws-sdk/client-amplify';

import {
  AmplifyAuthError,
  AmplifyNotFoundError,
  isNetworkFailure,
  isRejectedAnswer,
  isServerFault,
} from './errors';

/** Every region with Amplify Hosting (AWS's Amplify endpoints page,
 * 2026-10-23), in the order the picker lists them. */
export const AMPLIFY_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'ca-central-1',
  'sa-east-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-central-1',
  'eu-north-1',
  'eu-south-1',
  'me-south-1',
  'ap-south-1',
  'ap-east-1',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-northeast-3',
  'ap-southeast-1',
  'ap-southeast-2',
] as const;

/** The regions an account must opt in to. One it hasn't enabled rejects
 * the key as unrecognised (`UnrecognizedClientException`, the region
 * check of 2026-10-24, Decision 56), which elsewhere means a bad key; a
 * browser reads that answer as a 403 without its error type (the SDK's
 * `Unknown`, the real board's check of 2026-10-25), or may see a
 * network failure instead (Decision 48), so all of these are skipped
 * there, as is a server error (`me-south-1` timed out with a 504 for the
 * CLI, Q32; a browser gets no answer from it, and its request fails as a
 * network failure only after about 30 s, hence the time limit below). */
export const OPT_IN_REGIONS: ReadonlySet<string> = new Set([
  'ap-east-1',
  'eu-south-1',
  'me-south-1',
]);

/** How long an opt-in region's `ListApps` may take before its request is
 * cancelled and the region skipped as `unreachable` (the owner's choice,
 * Q33): every region that answered on the real board did so well within
 * it. A standard region has no limit: a slow one still has to answer,
 * since a partial list there could hide an app. */
export const OPT_IN_REGION_TIMEOUT_MS = 5000;

/** Why a region's apps aren't listed:
 * - `unavailable`: Amplify isn't there for the account (`NotFoundException`
 *   in any region; in an opt-in region, an auth error, a 401 or 403 of
 *   any type, or no readable answer: the account hasn't enabled it);
 * - `denied`: `AccessDeniedException`, in any region: an AWS
 *   organisation's policy blocks the region (the policy grants
 *   `ListApps` on `*`, so it isn't a missing permission);
 * - `unreachable`: in an opt-in region, a server error (5xx) or no
 *   answer within `OPT_IN_REGION_TIMEOUT_MS`. */
export type RegionSkip = 'unavailable' | 'denied' | 'unreachable';

/** The skips the board names in a note, since apps there can't be seen
 * (spec.md §3.12). */
export type NotedSkip = Exclude<RegionSkip, 'unavailable'>;

/** Is `skip` one the board names? */
export const isNotedSkip = (skip: RegionSkip): skip is NotedSkip =>
  skip !== 'unavailable';

/** One region's `ListApps` answer: its apps, or why it was skipped. */
export interface RegionListing {
  apps: App[];
  skipped?: RegionSkip;
}

/** An app and the region it was listed in. */
export interface RegionApp {
  region: string;
  app: App;
}

/** Why `err` from `region` skips the region, or `undefined` when it
 * fails the listing (any other error: a rejected key, a network failure
 * or a server error outside the opt-in regions, since a partial list
 * there could miss a real app). */
export function regionSkip(
  region: string,
  err: unknown,
): RegionSkip | undefined {
  if (err instanceof AmplifyNotFoundError) return 'unavailable';
  if (err instanceof AmplifyAuthError && err.accessDenied) return 'denied';
  if (!OPT_IN_REGIONS.has(region)) return undefined;
  if (
    err instanceof AmplifyAuthError ||
    isRejectedAnswer(err) ||
    isNetworkFailure(err)
  )
    return 'unavailable';
  return isServerFault(err) ? 'unreachable' : undefined;
}

/** Lists one region's apps; `signal` aborts the request. */
export type ListIn = (region: string, signal?: AbortSignal) => Promise<App[]>;

/** `listIn`'s apps for `region`; in an opt-in region, `undefined` once
 * `OPT_IN_REGION_TIMEOUT_MS` passes without an answer, the request
 * aborted through the signal it was given. */
async function answerWithinLimit(
  region: string,
  listIn: ListIn,
): Promise<App[] | undefined> {
  if (!OPT_IN_REGIONS.has(region)) return listIn(region);
  const cancel = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<undefined>((resolve) => {
    timer = setTimeout(() => {
      resolve(undefined);
      cancel.abort();
    }, OPT_IN_REGION_TIMEOUT_MS);
  });
  try {
    return await Promise.race([listIn(region, cancel.signal), limit]);
  } finally {
    clearTimeout(timer);
  }
}

/** `region`'s listing from `listIn`: its apps, or the skip its error (or,
 * in an opt-in region, its silence past the time limit) means; any other
 * error throws. */
export async function listRegion(
  region: string,
  listIn: ListIn,
): Promise<RegionListing> {
  try {
    const apps = await answerWithinLimit(region, listIn);
    return apps ? { apps } : { apps: [], skipped: 'unreachable' };
  } catch (err) {
    const skipped = regionSkip(region, err);
    if (skipped) return { apps: [], skipped };
    throw err;
  }
}

/** The apps of `listing`, each tagged with `region`. */
export const regionApps = (
  region: string,
  listing: RegionListing,
): RegionApp[] => listing.apps.map((app) => ({ region, app }));

/** The apps `listIn` finds in each of `regions`, all regions at once,
 * in region order; a skipped region lists none, and any region's error
 * throws. */
export async function listAppsAcrossRegions(
  regions: readonly string[],
  listIn: (region: string) => Promise<RegionListing>,
): Promise<RegionApp[]> {
  const perRegion = await Promise.all(
    regions.map(async (region) => regionApps(region, await listIn(region))),
  );
  return perRegion.flat();
}
