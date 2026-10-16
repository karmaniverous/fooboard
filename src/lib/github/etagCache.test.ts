/**
 * Tests for `EtagCache`: stores and retrieves per-URL entries.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { EtagCache } from './etagCache';

describe('EtagCache', () => {
  it('returns undefined for an unseen URL', () => {
    expect(new EtagCache().get('https://x/a')).toBeUndefined();
  });

  it('stores and retrieves an entry', () => {
    const cache = new EtagCache();
    cache.set('https://x/a', { etag: '"abc"', data: { ok: true } });
    expect(cache.get('https://x/a')).toEqual({
      etag: '"abc"',
      data: { ok: true },
    });
  });

  it('replaces an existing entry', () => {
    const cache = new EtagCache();
    cache.set('https://x/a', { etag: '"1"', data: 1 });
    cache.set('https://x/a', { etag: '"2"', data: 2 });
    expect(cache.get('https://x/a')).toEqual({ etag: '"2"', data: 2 });
  });

  it('keeps entries for different URLs separate', () => {
    const cache = new EtagCache();
    cache.set('https://x/a', { etag: '"1"', data: 'a' });
    cache.set('https://x/b', { etag: '"2"', data: 'b' });
    expect(cache.get('https://x/a')?.data).toBe('a');
    expect(cache.get('https://x/b')?.data).toBe('b');
  });
});
