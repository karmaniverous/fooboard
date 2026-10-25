/**
 * Tests for the region skip rules on what the AWS SDK really throws
 * (spec.md §3.12 *The search*, Decision 56): an opt-in region the
 * account hasn't enabled answers a browser with a 403 whose error type
 * it can't read, and the search skips it as unavailable; the same answer
 * from a standard region fails the listing.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { cannedReader, OPT_IN_REJECTION } from '@/test/amplifySdk';

import { listRegion } from './regions';

const list = (region: string, answer = OPT_IN_REJECTION) =>
  listRegion(region, () => cannedReader(region, answer).listApps());

describe('listRegion on SDK answers', () => {
  it.each(['eu-south-1', 'me-south-1', 'ap-east-1'])(
    'skips %s when it rejects the key with a 403 the browser cannot type',
    async (region) => {
      await expect(list(region)).resolves.toEqual({
        apps: [],
        skipped: 'unavailable',
      });
    },
  );

  it('skips an opt-in region rejecting with a 401 the browser cannot type', async () => {
    await expect(
      list('eu-south-1', { ...OPT_IN_REJECTION, statusCode: 401 }),
    ).resolves.toEqual({ apps: [], skipped: 'unavailable' });
  });

  it('fails a standard region rejecting the key the same way', async () => {
    await expect(list('us-east-1')).rejects.toThrow(
      'The security token included in the request is invalid.',
    );
  });

  it('fails an opt-in region answering any other client error', async () => {
    await expect(
      list('eu-south-1', { ...OPT_IN_REJECTION, statusCode: 400 }),
    ).rejects.toThrow('The security token included in the request is invalid.');
  });
});
