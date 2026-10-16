/**
 * Tests for `Link` header parsing and `paginateAll`'s page-following.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { paginateAll, parseLinkHeader } from './pagination';

describe('parseLinkHeader', () => {
  it('returns an empty map for null', () => {
    expect(parseLinkHeader(null)).toEqual({});
  });

  it('parses a single rel', () => {
    expect(
      parseLinkHeader('<https://api.github.com/x?page=2>; rel="next"'),
    ).toEqual({
      next: 'https://api.github.com/x?page=2',
    });
  });

  it('parses multiple rels', () => {
    const header =
      '<https://api.github.com/x?page=2>; rel="next", <https://api.github.com/x?page=5>; rel="last"';
    expect(parseLinkHeader(header)).toEqual({
      next: 'https://api.github.com/x?page=2',
      last: 'https://api.github.com/x?page=5',
    });
  });
});

describe('paginateAll', () => {
  it('follows rel="next" links until there is none', async () => {
    const pages: Record<
      string,
      { items: number[]; linkHeader: string | null }
    > = {
      'https://x/1': {
        items: [1, 2],
        linkHeader: '<https://x/2>; rel="next"',
      },
      'https://x/2': {
        items: [3, 4],
        linkHeader: '<https://x/3>; rel="next"',
      },
      'https://x/3': { items: [5], linkHeader: null },
    };
    const visited: string[] = [];

    const result = await paginateAll<number>('https://x/1', (url) => {
      visited.push(url);
      return Promise.resolve(pages[url]);
    });

    expect(result).toEqual([1, 2, 3, 4, 5]);
    expect(visited).toEqual(['https://x/1', 'https://x/2', 'https://x/3']);
  });

  it('returns a single page when there is no next link', async () => {
    const result = await paginateAll<string>('https://x/only', () =>
      Promise.resolve({ items: ['a', 'b'], linkHeader: null }),
    );
    expect(result).toEqual(['a', 'b']);
  });
});
