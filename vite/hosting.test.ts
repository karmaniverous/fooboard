import { describe, expect, it } from 'vitest';

import {
  hiddenFiles,
  parseCustomHttp,
  parseRewrites,
  rewrite,
  SPA_ENTRY,
} from './hosting';

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

describe('parseCustomHttp', () => {
  it('reads every header of the one pattern, by name', () => {
    expect(
      parseCustomHttp(
        customHttp('**', ['X-A', "a 'b'; c"], ['X-B', 'max-age=1']),
      ),
    ).toEqual({ 'X-A': "a 'b'; c", 'X-B': 'max-age=1' });
  });

  it.each([
    ['another pattern', customHttp('/assets/*', ['X-A', 'a'])],
    [
      'a second pattern',
      `${customHttp('**', ['X-A', 'a'])}\n${customHttp('**', ['X-B', 'b']).split('\n').slice(1).join('\n')}`,
    ],
    ['no headers', "customHeaders:\n  - pattern: '**'\n    headers: []"],
    ['an empty value', customHttp('**', ['X-A', ''])],
    ['an unknown key', `${customHttp('**', ['X-A', 'a'])}\nredirects: []`],
  ])('refuses %s', (_why, text) => {
    expect(() => parseCustomHttp(text)).toThrow();
  });

  it('refuses a header set twice, whatever its case', () => {
    expect(() =>
      parseCustomHttp(customHttp('**', ['X-A', 'a'], ['x-a', 'b'])),
    ).toThrow('Header x-a is set twice');
  });
});

/** An amplify-rewrites.json with one rule. */
const rules = (rule: Record<string, string>): string => JSON.stringify([rule]);
const RULE = { source: '</^[^.]+$/>', status: '200', target: SPA_ENTRY };

describe('parseRewrites', () => {
  it('reads a 200 rewrite to the page from an Amplify regular expression', () => {
    const [rule] = parseRewrites(rules(RULE));
    expect(rule.source.source).toBe('^[^.]+$');
    expect(rule.target).toBe(SPA_ENTRY);
  });

  it.each([
    ['a plain source', { ...RULE, source: '/<*>' }],
    ['a redirect', { ...RULE, status: '301' }],
    ['another target', { ...RULE, target: '/404.html' }],
  ])('refuses %s', (_why, rule) => {
    expect(() => parseRewrites(rules(rule))).toThrow();
  });

  it('refuses no rules', () => {
    expect(() => parseRewrites('[]')).toThrow();
  });
});

describe('rewrite', () => {
  const two = parseRewrites(
    JSON.stringify([
      { ...RULE, source: '</^\\/a$/>' },
      { ...RULE, source: '</^\\/b$/>' },
    ]),
  );

  it("serves any matching rule's target, else the path itself", () => {
    expect(rewrite(two, '/a')).toBe(SPA_ENTRY);
    expect(rewrite(two, '/b')).toBe(SPA_ENTRY);
    expect(rewrite(two, '/c.js')).toBe('/c.js');
  });
});

describe('hiddenFiles', () => {
  const noDots = parseRewrites(rules(RULE));

  it('lists the files a rule would answer with the page', () => {
    expect(hiddenFiles(noDots, ['/a.js', '/LICENSE', SPA_ENTRY])).toEqual([
      '/LICENSE',
    ]);
  });
});
