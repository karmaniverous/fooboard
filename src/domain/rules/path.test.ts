/**
 * Tests for path compilation: cached, strict RFC 9535, filter regexes
 * found wherever they sit in a filter expression, and case folding.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import {
  caseClass,
  caseless,
  compilePath,
  filterRegexes,
  quoted,
  valuesAt,
} from './path';

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

describe('caseless', () => {
  it('folds each letter into a class matching either case, and leaves the rest', () => {
    expect(caseless('Te-1')).toBe('[Tt][Ee]-1');
    expect(caseClass('x')).toBe('[Xx]');
    expect(caseClass('.')).toBeUndefined();
  });

  it('writes a pattern that matches whatever the case', () => {
    const path = compilePath(`$[?match(@, ${quoted(caseless('deploy'))})]`);
    if (!path.ok) throw new Error(path.message);
    expect(valuesAt(path.query, ['DePloy', 'deploy', 'deplo'])).toEqual([
      'DePloy',
      'deploy',
    ]);
  });
});
