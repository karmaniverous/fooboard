/**
 * Tests for sharing (spec.md C-19): the demo link under the base path and
 * X's compose page carrying the tagline and link.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { demoUrl, postUrl } from './share';
import { site } from './site';

describe('share links', () => {
  it('points at the demo and pre-fills an X post', () => {
    const link = demoUrl('https://fooboard.example');
    expect(link).toMatch(/^https:\/\/fooboard\.example\/.*demo$/);
    const post = new URL(postUrl(link));
    expect(post.origin + post.pathname).toBe('https://x.com/intent/post');
    expect(post.searchParams.get('text')).toBe(site.tagline);
    expect(post.searchParams.get('url')).toBe(link);
  });
});
