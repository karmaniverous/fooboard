/**
 * Tests for path compilation: cached, strict RFC 9535, and filter regexes
 * found wherever they sit in a filter expression.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { compilePath, filterRegexes } from './path';

describe('compilePath', () => {
  it('compiles once and caches', () => {
    expect(compilePath('$.a.b')).toBe(compilePath('$.a.b'));
  });

  it('reports a path that does not parse', () => {
    expect(compilePath('$.a[')).toMatchObject({ ok: false });
  });
});

describe('filterRegexes', () => {
  it('finds regexes in nested filter expressions, and nothing else', () => {
    const compiled = compilePath(
      "$.items[?search(@.name, 'te') && !match(@.state, 'fail.*') || @.x == 'y'].name",
    );
    if (!compiled.ok) throw new Error(compiled.message);
    expect(filterRegexes(compiled.query.segments).sort()).toEqual([
      'fail.*',
      'te',
    ]);
  });
});
