/**
 * Amplify row test helpers: the demo dashboard's Amplify rows, a row
 * derivation context over a query cache (the app search read from it),
 * and seeding the cache with the demo apps' branch lists and jobs, or
 * with an AWS key's app search answers per region.
 *
 * @module
 */
import type { App } from '@aws-sdk/client-amplify';
import type { QueryClient } from '@tanstack/query-core';

import { measureBoard } from '@/demo/scenarios/measure';
import { MEASURE_AMPLIFY_APPS as DEMO_AMPLIFY_APPS } from '@/demo/scenarios/measureBoard';
import { cellRulesFor } from '@/domain/config/cellRules';
import type { Dashboard } from '@/domain/config/dashboard';
import type { AmplifyRow } from '@/domain/config/row';
import { sourceRuleFor } from '@/domain/model/sources';
import { resolveSetting } from '@/domain/settings/resolve';
import type { AmplifyContext } from '@/engine/amplifyRow';
import { appSearch } from '@/engine/appSearch';
import { AMPLIFY_REGIONS, type RegionListing } from '@/lib/amplify/regions';
import { chosenBranches } from '@/lib/amplify/rowJobs';
import { amplifyApp } from '@/lib/amplify/sdkShapes';
import { amplifyKey } from '@/query/keys';

import { fetched } from './fakeReaders';
import { simAmplifyReaderFor } from './simDemo';

/** The demo AWS key. */
export const AWS = 'demo-aws';
const readerFor = simAmplifyReaderFor();
export const amplifySource = sourceRuleFor(measureBoard, 'amplify');

/** A demo Amplify row by id. */
export const rowOf = (id: string): AmplifyRow => {
  const row = measureBoard.rows.find((r) => r.id === id);
  if (row?.type !== 'amplify') throw new Error(`${id} is not an Amplify row`);
  return row;
};

/** A derivation context for `dashboard` (the demo's) over `client`. */
export const amplifyCtx = (
  client: QueryClient,
  hasReader = true,
  dashboard: Dashboard = measureBoard,
): AmplifyContext => ({
  client,
  stages: dashboard.stages,
  rulesFor: (row, stageId) => cellRulesFor(dashboard, row, stageId),
  keyFor: (row, stageId) =>
    resolveSetting(dashboard, row, stageId, 'awsKey').value,
  hasReader: () => hasReader,
  search: (id) => appSearch(client, id),
  keyLabel: (id) => `key ${id}`,
  source: amplifySource,
  now: 0,
  fetchStartedAt: () => undefined,
  boostOf: () => undefined,
});

/** Seed one demo app's branch list and, unless `branchesOnly`, its jobs,
 * read with `key`. */
export async function seedApp(
  client: QueryClient,
  region: string,
  appId: string,
  branchesOnly = false,
  key = AWS,
): Promise<void> {
  const reader = readerFor({ credentialId: key, region });
  const branches = await reader.listBranches(appId);
  client.setQueryData(
    amplifyKey(key, { call: 'branches', region, appId }),
    fetched(branches),
  );
  if (branchesOnly) return;
  const max = amplifySource.reader.jobsPerBranch;
  for (const branch of chosenBranches(branches, amplifySource.reader))
    client.setQueryData(
      amplifyKey(key, { call: 'jobs', region, appId, branch, max }),
      fetched(await reader.listJobs(appId, branch, max)),
    );
}

/** Seed every pinned app of demo row `id`. */
export const seedRow = async (
  client: QueryClient,
  id: keyof typeof DEMO_AMPLIFY_APPS,
  branchesOnly = false,
): Promise<void> => {
  for (const s of DEMO_AMPLIFY_APPS[id])
    await seedApp(client, s.region, s.appId, branchesOnly);
};

/** An app as `ListApps` lists it, building `repo` (a GitHub URL). */
export const listedApp = (appId: string, repo?: string, name = appId): App =>
  amplifyApp({
    appId,
    name,
    ...(repo ? { repository: `https://github.com/${repo}` } : {}),
  });

/** Seed `region`'s `ListApps` under `key` as failed with `error`. */
export async function seedSearchError(
  client: QueryClient,
  key: string,
  region: string,
  error: Error,
): Promise<void> {
  await client
    .query({
      queryKey: amplifyKey(key, { call: 'apps', region }),
      queryFn: () => Promise.reject(error),
      retry: false,
    })
    .catch(() => undefined);
}

/** Seed `key`'s app search: every region answers, with `byRegion`'s apps
 * or skip, the others with no apps. */
export function seedSearch(
  client: QueryClient,
  key: string,
  byRegion: Partial<Record<string, App[] | RegionListing>> = {},
): void {
  for (const region of AMPLIFY_REGIONS) {
    const found = byRegion[region] ?? [];
    client.setQueryData(
      amplifyKey(key, { call: 'apps', region }),
      fetched(Array.isArray(found) ? { apps: found } : found),
    );
  }
}
