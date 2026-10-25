/**
 * Editor lookups (spec.md §3.1): the repo picker, branch finder and app
 * picker read through the same queries, cache and limiter as the board,
 * a page at a time until GitHub's `Link` says the list ends, and the app
 * picker one `apps` query per Amplify Hosting region, the same queries
 * as the board's app search (spec.md §3.12). A lookup stays fresh for
 * `EDITOR_STALE_MS`, so reopening an editor reads nothing.
 *
 * @module
 */
import type { QueryClient } from '@tanstack/query-core';

import {
  AMPLIFY_REGIONS,
  listAppsAcrossRegions,
  type RegionApp,
  type RegionListing,
} from '@/lib/amplify/regions';
import type { Branch, Fetched, Repo } from '@/lib/github';

import { EDITOR_STALE_MS } from './intervals';
import { amplifyKey, githubKey, type GithubQueryKey } from './keys';

/** Every page of a GitHub list, `keyFor(page)` keying each. */
async function allPages<T>(
  client: QueryClient,
  keyFor: (page: number) => GithubQueryKey,
): Promise<T[]> {
  const items: T[] = [];
  for (let page = 1; ; page += 1) {
    const fetched = await client.query<Fetched<T[]>>({
      queryKey: keyFor(page),
      staleTime: EDITOR_STALE_MS,
    });
    items.push(...fetched.data);
    if (!fetched.hasNext) return items;
  }
}

/** The repos a GitHub token can see. */
export const fetchRepos = (
  client: QueryClient,
  credentialId: string,
): Promise<Repo[]> =>
  allPages(client, (page) => githubKey(credentialId, { call: 'repos', page }));

/** A repo's branches. */
export const fetchBranches = (
  client: QueryClient,
  credentialId: string,
  repo: string,
): Promise<Branch[]> =>
  allPages(client, (page) =>
    githubKey(credentialId, { call: 'branches', repo, page }),
  );

/** The Amplify apps an AWS key can see in `region`, or why the region
 * is skipped: the app search's query (spec.md §3.12). */
export async function fetchApps(
  client: QueryClient,
  credentialId: string,
  region: string,
): Promise<RegionListing> {
  const fetched = await client.query<Fetched<RegionListing>>({
    queryKey: amplifyKey(credentialId, { call: 'apps', region }),
    staleTime: EDITOR_STALE_MS,
  });
  return fetched.data;
}

/** The Amplify apps an AWS key can see in every Amplify Hosting region,
 * each tagged with its region; regions where Amplify is unavailable to
 * the account are skipped. */
export const fetchAppsAcrossRegions = (
  client: QueryClient,
  credentialId: string,
): Promise<RegionApp[]> =>
  listAppsAcrossRegions(AMPLIFY_REGIONS, (region) =>
    fetchApps(client, credentialId, region),
  );
