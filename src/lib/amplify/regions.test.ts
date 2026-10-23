/**
 * Tests for `listAppsAcrossRegions` over fake per-region listings: apps
 * are tagged with their region in region order, regions where Amplify is
 * unavailable (not found, an opt-in region the account hasn't enabled)
 * are skipped, and a rejected key throws.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { amplifyApp } from '@/lib/amplify/sdkShapes';

import { AmplifyAuthError, AmplifyNotFoundError } from './errors';
import {
  AMPLIFY_REGIONS,
  listAppsAcrossRegions,
  OPT_IN_REGIONS,
} from './regions';

const listing =
  (byRegion: Record<string, string[] | Error>) => (region: string) => {
    const found = byRegion[region] ?? [];
    return found instanceof Error
      ? Promise.reject(found)
      : Promise.resolve(found.map((appId) => amplifyApp({ appId })));
  };

const tags = (found: Awaited<ReturnType<typeof listAppsAcrossRegions>>) =>
  found.map((f) => `${f.region}:${f.app.appId ?? ''}`);

describe('listAppsAcrossRegions', () => {
  it('tags each app with its region, in region order', async () => {
    const found = await listAppsAcrossRegions(
      ['us-east-1', 'eu-west-1', 'ap-south-1'],
      listing({ 'eu-west-1': ['b1'], 'us-east-1': ['a1', 'a2'] }),
    );
    expect(tags(found)).toEqual([
      'us-east-1:a1',
      'us-east-1:a2',
      'eu-west-1:b1',
    ]);
  });

  it('skips a region that answers not found, and an opt-in region that rejects the key', async () => {
    const found = await listAppsAcrossRegions(
      ['us-east-1', 'us-west-2', 'me-south-1'],
      listing({
        'us-east-1': ['a1'],
        'us-west-2': new AmplifyNotFoundError('not here', 'ListApps'),
        'me-south-1': new AmplifyAuthError('not enabled', 'ListApps'),
      }),
    );
    expect(tags(found)).toEqual(['us-east-1:a1']);
  });

  it.each([
    [
      'a rejected key in a default region',
      new AmplifyAuthError('denied', 'ListApps'),
    ],
    ['any other error in an opt-in region', new Error('Failed to fetch')],
  ])('throws %s', async (_, error) => {
    const region =
      error instanceof AmplifyAuthError ? 'us-east-1' : 'ap-east-1';
    await expect(
      listAppsAcrossRegions([region], listing({ [region]: error })),
    ).rejects.toBe(error);
  });

  it('lists each region once, and every opt-in region is listed', () => {
    expect(new Set(AMPLIFY_REGIONS).size).toBe(AMPLIFY_REGIONS.length);
    for (const region of OPT_IN_REGIONS)
      expect(AMPLIFY_REGIONS).toContain(region);
  });
});
