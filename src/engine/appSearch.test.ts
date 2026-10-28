/**
 * Tests for one key's app search read from the cache (spec.md §3.12): a
 * query per region, refetched hourly; loading until every region has
 * answered (a rate-limited region keeps loading); the first failed
 * region fails it; the apps of every region, with the noted skips; and
 * the matches of a repo.
 *
 * @module
 */
import { QueryClient } from '@tanstack/query-core';
import { describe, expect, it } from 'vitest';

import { AmplifyThrottledError } from '@/lib/amplify/errors';
import { AMPLIFY_REGIONS } from '@/lib/amplify/regions';
import { amplifyApp } from '@/lib/amplify/sdkShapes';
import { APP_SEARCH_INTERVAL_MS } from '@/query/intervals';
import { amplifyKey } from '@/query/keys';
import { listedApp, seedSearch, seedSearchError } from '@/test/amplifyRows';

import { appSearch, matchingApps } from './appSearch';

const KEY = 'aws';

describe('appSearch', () => {
  it('needs one query per region, refetched hourly', () => {
    const { needs, state } = appSearch(new QueryClient(), KEY);
    expect(state).toEqual({ kind: 'loading' });
    expect(needs.map((n) => n.key[2])).toEqual(
      AMPLIFY_REGIONS.map((region) => ({ call: 'apps', region })),
    );
    expect(new Set(needs.map((n) => n.freshness.refetchInterval))).toEqual(
      new Set([APP_SEARCH_INTERVAL_MS]),
    );
  });

  it('keeps loading while a region is rate-limited', async () => {
    const client = new QueryClient();
    seedSearch(client, KEY);
    client.removeQueries({
      queryKey: amplifyKey(KEY, { call: 'apps', region: 'eu-north-1' }),
    });
    await seedSearchError(
      client,
      KEY,
      'eu-north-1',
      new AmplifyThrottledError('slow down', 'ListApps', 1_000),
    );
    expect(appSearch(client, KEY).state).toEqual({ kind: 'loading' });
  });

  it('fails on the first failed region', async () => {
    const client = new QueryClient();
    seedSearch(client, KEY);
    for (const region of ['eu-west-1', 'us-west-2']) {
      client.removeQueries({
        queryKey: amplifyKey(KEY, { call: 'apps', region }),
      });
      await seedSearchError(client, KEY, region, new Error(region));
    }
    const first = AMPLIFY_REGIONS.find(
      (r) => r === 'eu-west-1' || r === 'us-west-2',
    );
    expect(appSearch(client, KEY).state).toMatchObject({
      kind: 'failed',
      region: first,
    });
  });

  it('collects every region, noting the denied and unreachable', () => {
    const client = new QueryClient();
    seedSearch(client, KEY, {
      'us-east-1': [listedApp('a1', 'acme/web')],
      'eu-west-1': [listedApp('b1', 'acme/api')],
      'ap-south-1': { apps: [], skipped: 'denied' },
      'eu-south-1': { apps: [], skipped: 'unavailable' },
    });
    const { state } = appSearch(client, KEY);
    if (state.kind !== 'done') throw new Error(state.kind);
    expect(state.apps.map((a) => `${a.region}:${a.app.appId ?? ''}`)).toEqual([
      'us-east-1:a1',
      'eu-west-1:b1',
    ]);
    expect(state.noted).toEqual([{ region: 'ap-south-1', skip: 'denied' }]);
  });
});

describe('matchingApps', () => {
  it('finds the apps with an id that build the repo, named', () => {
    const apps = [
      { region: 'us-east-1', app: listedApp('a1', 'Acme/Web', 'web') },
      { region: 'us-east-1', app: listedApp('a2', 'acme/api') },
      {
        region: 'eu-west-1',
        app: amplifyApp({
          name: 'ghost',
          repository: 'https://github.com/acme/web',
        }),
      },
      {
        region: 'eu-west-1',
        app: amplifyApp({
          appId: 'a3',
          repository: 'https://github.com/acme/web',
        }),
      },
    ];
    expect(matchingApps(apps, KEY, 'acme/web')).toEqual([
      { credentialId: KEY, region: 'us-east-1', appId: 'a1', name: 'web' },
      { credentialId: KEY, region: 'eu-west-1', appId: 'a3', name: 'a3' },
    ]);
  });
});
