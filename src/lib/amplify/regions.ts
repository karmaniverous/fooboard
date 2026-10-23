/**
 * The regions the Amplify app picker lists (spec.md §3.1, Decisions 21
 * and 29): every AWS region with Amplify Hosting, a named list updated by
 * release, and the listing across them, one `ListApps` per region. A
 * region where Amplify isn't available to the account is skipped.
 *
 * @module
 */
import type { App } from '@aws-sdk/client-amplify';

import {
  AmplifyAuthError,
  AmplifyNotFoundError,
  isNetworkFailure,
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
 * the key as unrecognised, which elsewhere means a bad key; whether the
 * browser can read that answer, or sees a network failure instead, is
 * unverified (Decision 48), so both are skipped there. */
export const OPT_IN_REGIONS: ReadonlySet<string> = new Set([
  'ap-east-1',
  'eu-south-1',
  'me-south-1',
]);

/** An app and the region it was listed in. */
export interface RegionApp {
  region: string;
  app: App;
}

/** Does `err` from `region` mean Amplify isn't available there to the
 * account (not found, or an opt-in region it hasn't enabled, which
 * rejects the key or gives no readable response)? */
const unavailable = (region: string, err: unknown): boolean =>
  err instanceof AmplifyNotFoundError ||
  (OPT_IN_REGIONS.has(region) &&
    (err instanceof AmplifyAuthError || isNetworkFailure(err)));

/** The apps `listIn` finds in each of `regions`, all regions at once,
 * in region order. Regions where Amplify is unavailable are skipped;
 * any other error (a rejected key, a network failure outside the opt-in
 * regions) throws. */
export async function listAppsAcrossRegions(
  regions: readonly string[],
  listIn: (region: string) => Promise<App[]>,
): Promise<RegionApp[]> {
  const perRegion = await Promise.all(
    regions.map(async (region) => {
      try {
        return (await listIn(region)).map((app) => ({ region, app }));
      } catch (err) {
        if (unavailable(region, err)) return [];
        throw err;
      }
    }),
  );
  return perRegion.flat();
}
