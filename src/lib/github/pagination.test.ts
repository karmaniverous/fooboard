/**
 * Tests for `Link` header parsing.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { parseLinkHeader } from './pagination';

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

  it('skips a part it cannot read', () => {
    const header = 'garbage, <https://api.github.com/x?page=2>; rel="next"';
    expect(parseLinkHeader(header)).toEqual({
      next: 'https://api.github.com/x?page=2',
    });
  });
});
