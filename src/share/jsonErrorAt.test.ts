/**
 * Tests for where text stops being JSON (spec 0.2.0 §3.J *No quoted input
 * in error messages*): JSON is accepted exactly when `JSON.parse` accepts
 * it, and the refused offset is the one V8 reports where V8 reports one.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { jsonErrorAt, lineColumn } from './jsonErrorAt';

const parses = (text: string): boolean => {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

describe('jsonErrorAt', () => {
  it.each([
    '{}',
    ' [ ] ',
    '{"a":[1,-2.5e+3,0,0.1E9,true,false,null,"x\\"\\\\\\/\\b\\f\\n\\r\\t\\u00aF"]}',
    '"\u00e9"',
    '-0',
    '\n{"a" : { "b" : [ {} ] } }\r\n',
  ])('accepts JSON: %s', (text) => {
    expect(parses(text)).toBe(true);
    expect(jsonErrorAt(text)).toBeUndefined();
  });

  it.each([
    ['', 0],
    ['   ', 3],
    ['{', 1],
    ['{,}', 1],
    ['[1,]', 3],
    ['[1 2]', 3],
    ['{"a" 1}', 5],
    ['{"a":1,}', 7],
    ['{"a":1} x', 8],
    ['{"a":"b', 7],
    ['"a\nb"', 2],
    ['"\\x"', 2],
    ['"\\u12g4"', 5],
    ['01', 1],
    ['-', 1],
    ['1.', 2],
    ['1e', 2],
    ['+1', 0],
    ['tru', 3],
    ['nul!', 3],
    ['ghp_secret', 0],
    ['{"t": ghp_SECRET"x"}', 6],
    ['[1]]', 3],
  ])('refuses %j at %i, as JSON.parse does', (text, at) => {
    expect(parses(text)).toBe(false);
    expect(jsonErrorAt(text)).toBe(at);
  });

  it.each(['{"a":1} x', '{"a":"ghp_', '{', '{"a":1,}'])(
    'agrees with the offset V8 gives for %j',
    (text) => {
      let message = '';
      try {
        JSON.parse(text);
      } catch (err) {
        message = String(err);
      }
      const v8 = /position (\d+)/.exec(message)?.[1];
      expect(jsonErrorAt(text)).toBe(Number(v8));
    },
  );

  it('gives no offset for nesting too deep to scan', () => {
    expect(jsonErrorAt('['.repeat(100_000))).toBeUndefined();
  });
});

describe('lineColumn', () => {
  it('counts lines and columns from 1', () => {
    expect(lineColumn('ab\ncd', 0)).toEqual({ line: 1, column: 1 });
    expect(lineColumn('ab\ncd', 4)).toEqual({ line: 2, column: 2 });
    expect(lineColumn('ab\n', 3)).toEqual({ line: 2, column: 1 });
  });
});
