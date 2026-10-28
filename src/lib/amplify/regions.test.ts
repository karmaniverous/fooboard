/**
 * Tests for the region skip rules (spec.md §3.1 *Amplify regions*, §3.12
 * *The search*, Decisions 54 and 56, Q32): `NotFoundException` is skipped
 * in any region and `AccessDeniedException` too (noted); in an opt-in
 * region an auth error or a network failure is skipped silently and a
 * server error with a note; anything else, or those errors elsewhere,
 * fails the listing. `listAppsAcrossRegions` tags apps with their region
 * in region order.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { amplifyApp } from '@/lib/amplify/sdkShapes';

import {
  AmplifyAuthError,
  AmplifyNotFoundError,
  toAmplifyError,
} from './errors';
import {
  AMPLIFY_REGIONS,
  isNotedSkip,
  listAppsAcrossRegions,
  listRegion,
  OPT_IN_REGIONS,
  type RegionListing,
  regionSkip,
} from './regions';

/** An AWS SDK error as the SDK throws it. */
const awsError = (name: string, fault: 'client' | 'server' = 'client') =>
  Object.assign(new Error(name), { name, $fault: fault });

const denied = () =>
  toAmplifyError(awsError('AccessDeniedException'), 'ListApps');
const unrecognised = () =>
  toAmplifyError(awsError('UnrecognizedClientException'), 'ListApps');
const gatewayTimeout = () => awsError('UnknownError', 'server');
/** What the SDK throws for a gateway timeout's HTML page: a parse error
 * with the raw response (or its metadata) attached, and no `$fault`. */
const unparsed = (field: '$response' | '$metadata', status: number) =>
  Object.assign(new SyntaxError("Unexpected token '<'"), {
    [field]:
      field === '$response'
        ? { statusCode: status }
        : { httpStatusCode: status },
  });

describe('regionSkip', () => {
  it.each([
    [
      'NotFoundException in a standard region',
      'us-east-1',
      () => new AmplifyNotFoundError('x', 'ListApps'),
      'unavailable',
    ],
    [
      'NotFoundException in an opt-in region',
      'me-south-1',
      () => new AmplifyNotFoundError('x', 'ListApps'),
      'unavailable',
    ],
    [
      'AccessDeniedException in a standard region',
      'eu-west-1',
      denied,
      'denied',
    ],
    [
      'AccessDeniedException in an opt-in region',
      'ap-east-1',
      denied,
      'denied',
    ],
    [
      'UnrecognizedClientException in an opt-in region',
      'eu-south-1',
      unrecognised,
      'unavailable',
    ],
    [
      'a network failure in an opt-in region',
      'eu-south-1',
      () => new TypeError('Failed to fetch'),
      'unavailable',
    ],
    ['a 5xx in an opt-in region', 'me-south-1', gatewayTimeout, 'unreachable'],
    [
      'an unparsed 504 page in an opt-in region',
      'me-south-1',
      () => unparsed('$response', 504),
      'unreachable',
    ],
    [
      'an unparsed 5xx with metadata in an opt-in region',
      'me-south-1',
      () => unparsed('$metadata', 503),
      'unreachable',
    ],
  ] as const)('skips %s', (_, region, error, skip) => {
    expect(regionSkip(region, error())).toBe(skip);
  });

  it.each([
    [
      'UnrecognizedClientException in a standard region',
      'us-east-1',
      unrecognised,
    ],
    [
      'a network failure in a standard region',
      'eu-west-1',
      () => new TypeError('Failed to fetch'),
    ],
    ['a 5xx in a standard region', 'us-west-2', gatewayTimeout],
    [
      'an unparsed 504 page in a standard region',
      'us-west-2',
      () => unparsed('$response', 504),
    ],
    [
      'an unparsed 4xx page in an opt-in region',
      'me-south-1',
      () => unparsed('$response', 400),
    ],
    [
      'a parse error with no status in an opt-in region',
      'me-south-1',
      () => Object.assign(new SyntaxError('x'), { $response: 'odd' }),
    ],
    [
      'a client error in an opt-in region',
      'ap-east-1',
      () => awsError('BadRequestException'),
    ],
    [
      'any other error in an opt-in region',
      'ap-east-1',
      () => new Error('Internal failure'),
    ],
  ] as const)('fails on %s', (_, region, error) => {
    expect(regionSkip(region, error())).toBeUndefined();
  });

  it('notes denied and unreachable regions only', () => {
    expect(isNotedSkip('denied')).toBe(true);
    expect(isNotedSkip('unreachable')).toBe(true);
    expect(isNotedSkip('unavailable')).toBe(false);
  });

  it('marks only AccessDeniedException as denied among the auth errors', () => {
    const err = denied();
    expect(err).toBeInstanceOf(AmplifyAuthError);
    expect(err).toMatchObject({ accessDenied: true });
    expect(unrecognised()).toMatchObject({ accessDenied: false });
  });
});

describe('listRegion', () => {
  it('lists the region, or answers the skip, or throws', async () => {
    const app = amplifyApp({ appId: 'd1' });
    await expect(
      listRegion('us-east-1', () => Promise.resolve([app])),
    ).resolves.toEqual({ apps: [app] });
    await expect(
      listRegion('eu-west-1', () =>
        Promise.reject(new AmplifyAuthError('denied', 'ListApps', true)),
      ),
    ).resolves.toEqual({ apps: [], skipped: 'denied' });
    const failure = new TypeError('Failed to fetch');
    await expect(
      listRegion('us-east-1', () => Promise.reject(failure)),
    ).rejects.toBe(failure);
  });
});

describe('listAppsAcrossRegions', () => {
  const listings: Record<string, RegionListing> = {
    'us-east-1': {
      apps: [amplifyApp({ appId: 'a1' }), amplifyApp({ appId: 'a2' })],
    },
    'eu-west-1': { apps: [amplifyApp({ appId: 'b1' })] },
    'ap-south-1': { apps: [], skipped: 'denied' },
  };

  it('tags each app with its region, in region order', async () => {
    const found = await listAppsAcrossRegions(
      ['us-east-1', 'eu-west-1', 'ap-south-1'],
      (region) => Promise.resolve(listings[region] ?? { apps: [] }),
    );
    expect(found.map((f) => `${f.region}:${f.app.appId ?? ''}`)).toEqual([
      'us-east-1:a1',
      'us-east-1:a2',
      'eu-west-1:b1',
    ]);
  });

  it("throws a region's error", async () => {
    const error = new Error('boom');
    await expect(
      listAppsAcrossRegions(['us-east-1'], () => Promise.reject(error)),
    ).rejects.toBe(error);
  });

  it('lists each region once, and every opt-in region is listed', () => {
    expect(new Set(AMPLIFY_REGIONS).size).toBe(AMPLIFY_REGIONS.length);
    for (const region of OPT_IN_REGIONS)
      expect(AMPLIFY_REGIONS).toContain(region);
  });
});
