import { describe, expect, it } from 'vitest';

import { headersFor, parseCustomHttp } from './hosting';

/** A customHttp.yml with these header entries under one pattern. */
const customHttp = (pattern: string, ...entries: [string, string][]): string =>
  [
    'customHeaders:',
    `  - pattern: '${pattern}'`,
    '    headers:',
    ...entries.flatMap(([key, value]) => [
      `      - key: '${key}'`,
      `        value: "${value}"`,
    ]),
  ].join('\n');

/** `first` followed by the pattern entries of each of `more`. */
const patterns = (first: string, ...more: string[]): string =>
  [first, ...more.map((m) => m.split('\n').slice(1).join('\n'))].join('\n');

const MARKDOWN: [string, string] = ['Content-Type', 'text/markdown'];

describe('parseCustomHttp', () => {
  it("reads every header of the '**' pattern, by name", () => {
    expect(
      parseCustomHttp(
        customHttp('**', ['X-A', "a 'b'; c"], ['X-B', 'max-age=1']),
      ),
    ).toEqual({
      every: { 'X-A': "a 'b'; c", 'X-B': 'max-age=1' },
      byPath: {},
    });
  });

  it("reads several one-path patterns after '**', each by its path", () => {
    expect(
      parseCustomHttp(
        patterns(
          customHttp('**', ['X-A', 'a']),
          customHttp('/ai', MARKDOWN),
          customHttp('/ai.md', MARKDOWN, ['X-B', 'b']),
        ),
      ),
    ).toEqual({
      every: { 'X-A': 'a' },
      byPath: {
        '/ai': { 'Content-Type': 'text/markdown' },
        '/ai.md': { 'Content-Type': 'text/markdown', 'X-B': 'b' },
      },
    });
  });

  it.each([
    ["a first pattern other than '**'", customHttp('/ai', ['X-A', 'a'])],
    [
      "'**' after a one-path pattern",
      patterns(customHttp('/ai', MARKDOWN), customHttp('**', ['X-A', 'a'])),
    ],
    [
      'a glob pattern after it',
      patterns(
        customHttp('**', ['X-A', 'a']),
        customHttp('/assets/*', MARKDOWN),
      ),
    ],
    [
      'a path without its slash',
      patterns(customHttp('**', ['X-A', 'a']), customHttp('ai', MARKDOWN)),
    ],
    [
      "a second '**' pattern",
      patterns(customHttp('**', ['X-A', 'a']), customHttp('**', ['X-B', 'b'])),
    ],
    ['no headers', "customHeaders:\n  - pattern: '**'\n    headers: []"],
    ['an empty value', customHttp('**', ['X-A', ''])],
    ['a header name with a space', customHttp('**', ['X-Frame Options', 'a'])],
    ['an empty header name', customHttp('**', ['', 'a'])],
    ['an unknown key', `${customHttp('**', ['X-A', 'a'])}\nredirects: []`],
  ])('refuses %s', (_why, text) => {
    expect(() => parseCustomHttp(text)).toThrow();
  });

  it('refuses a header set twice, whatever its case', () => {
    expect(() =>
      parseCustomHttp(customHttp('**', ['X-A', 'a'], ['x-a', 'b'])),
    ).toThrow('Header x-a is set twice');
  });

  it("refuses a one-path pattern setting a header '**' sets, whatever its case", () => {
    expect(() =>
      parseCustomHttp(
        patterns(
          customHttp('**', ['X-A', 'a']),
          customHttp('/ai', ['x-a', 'a']),
        ),
      ),
    ).toThrow("Header x-a of /ai is set by '**' too");
  });

  it('refuses a path named by two patterns', () => {
    expect(() =>
      parseCustomHttp(
        patterns(
          customHttp('**', ['X-A', 'a']),
          customHttp('/ai', MARKDOWN),
          customHttp('/ai', ['X-B', 'b']),
        ),
      ),
    ).toThrow('Header pattern /ai is named twice');
  });
});

describe('headersFor', () => {
  const hosting = parseCustomHttp(
    patterns(
      customHttp('**', ['X-A', 'a'], ['X-B', 'b']),
      customHttp('/ai', MARKDOWN),
    ),
  );

  it("merges '**' with the pattern naming the path", () => {
    expect(headersFor(hosting, '/ai')).toEqual({
      'X-A': 'a',
      'X-B': 'b',
      'Content-Type': 'text/markdown',
    });
  });

  it("gives any other path only '**'", () => {
    expect(headersFor(hosting, '/ai.md')).toEqual({ 'X-A': 'a', 'X-B': 'b' });
  });
});
