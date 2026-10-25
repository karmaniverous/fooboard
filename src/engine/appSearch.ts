/**
 * The app search under one AWS key (spec.md §3.12 *The search*): the
 * `apps` query of every region in `AMPLIFY_REGIONS`, read from the cache,
 * refetched every `APP_SEARCH_INTERVAL_MS`. The search is done once every
 * region has answered or been skipped; regions skipped for a denial or an
 * opt-in server error are named, since apps there can't be seen; any
 * other failure fails the search, naming the region, since a partial list
 * could miss the app. The apps that build a row's repo are its matches.
 * Pure.
 *
 * @module
 */
import type { QueryClient } from '@tanstack/query-core';

import { buildsRepo } from '@/domain/matching';
import {
  AMPLIFY_REGIONS,
  isNotedSkip,
  type NotedSkip,
  type RegionApp,
  regionApps,
} from '@/lib/amplify/regions';
import type { ResolvedAmplifySource } from '@/lib/amplify/rowJobs';
import { amplifySnapshot } from '@/query/cache';
import { APP_SEARCH_FRESHNESS } from '@/query/intervals';
import { amplifyKey } from '@/query/keys';

import type { Need } from './need';
import { type FailureOutcome, failureOutcome } from './providerOutcome';

/** A region skipped in a way the board names. */
export interface NotedRegion {
  region: string;
  skip: NotedSkip;
}

/** Where a key's search stands. */
type SearchState =
  | { kind: 'loading' }
  | { kind: 'failed'; region: string; outcome: FailureOutcome }
  | { kind: 'done'; apps: RegionApp[]; noted: NotedRegion[] };

export interface AppSearch {
  state: SearchState;
  /** The search's queries, one per region. */
  needs: Need[];
}

/** The search under `credentialId`, from the cache. */
export function appSearch(
  client: QueryClient,
  credentialId: string,
): AppSearch {
  const needs: Need[] = [];
  const apps: RegionApp[] = [];
  const noted: NotedRegion[] = [];
  let state: SearchState | undefined;
  for (const region of AMPLIFY_REGIONS) {
    const request = { call: 'apps', region } as const;
    needs.push({
      key: amplifyKey(credentialId, request),
      freshness: APP_SEARCH_FRESHNESS,
    });
    if (state) continue;
    const snap = amplifySnapshot(client, credentialId, request);
    const outcome = failureOutcome(snap.failed, snap.error);
    if (outcome) state = { kind: 'failed', region, outcome };
    else if (!snap.data) state = { kind: 'loading' };
    else {
      const listing = snap.data.data;
      apps.push(...regionApps(region, listing));
      if (listing.skipped && isNotedSkip(listing.skipped))
        noted.push({ region, skip: listing.skipped });
    }
  }
  return { state: state ?? { kind: 'done', apps, noted }, needs };
}

/** An app the search found building a row's repo. */
export type FoundApp = ResolvedAmplifySource & { name: string };

/** The apps in `apps`, listed under `credentialId`, that build `repo`. */
export const matchingApps = (
  apps: readonly RegionApp[],
  credentialId: string,
  repo: string,
): FoundApp[] =>
  apps.flatMap(({ region, app }) =>
    app.appId && buildsRepo(app.repository, repo)
      ? [
          {
            credentialId,
            region,
            appId: app.appId,
            name: app.name ?? app.appId,
          },
        ]
      : [],
  );
