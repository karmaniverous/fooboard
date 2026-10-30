import { describe, expect, it } from 'vitest';

import {
  hiddenFiles,
  parseRewrites,
  REDIRECT_STATUSES,
  rewrite,
  SPA_ENTRY,
} from './hostingRules';

/** An amplify-rewrites.json with these rules. */
const rules = (...list: Record<string, string | null>[]): string =>
  JSON.stringify(list);
const RULE = { source: '</^[^.]+$/>', status: '200', target: SPA_ENTRY };
const AI = { source: '/ai', status: '200', target: '/ai.md' };
const APEX = {
  source: 'https://fooboard.dev',
  status: '302',
  target: 'https://www.fooboard.dev',
};

describe('parseRewrites', () => {
  it('reads a redirect from a bare origin with its slash', () => {
    expect(
      parseRewrites(rules({ ...APEX, source: 'https://fooboard.dev/' }, RULE))
        .redirects,
    ).toHaveLength(1);
  });

  it.each(['https://fooboard.dev/a', 'https://fooboard.dev/?a'])(
    'refuses a full-URL source that is not a bare origin: %s',
    (source) => {
      expect(() => parseRewrites(rules({ ...APEX, source }, RULE))).toThrow(
        'not a plain path or a bare http(s) origin (no path or query)',
      );
    },
  );

  it('reads a redirect from a full URL, which matches no local path', () => {
    expect(parseRewrites(rules(APEX, AI, RULE)).redirects).toEqual([
      { path: undefined, status: '302', target: 'https://www.fooboard.dev' },
    ]);
  });

  it('reads the console\'s shape, `"condition": null` on every rule, as unconditioned', () => {
    const { redirects, rewrites } = parseRewrites(
      rules(...[APEX, AI, RULE].map((rule) => ({ ...rule, condition: null }))),
    );
    expect(redirects).toEqual([
      {
        path: undefined,
        status: '302',
        target: 'https://www.fooboard.dev',
        condition: undefined,
      },
    ]);
    expect(rewrites.map(({ condition }) => condition)).toEqual([
      undefined,
      undefined,
    ]);
  });

  it('reads a country condition on any rule', () => {
    const { redirects, rewrites } = parseRewrites(
      rules(
        ...[APEX, AI, RULE].map((rule) => ({ ...rule, condition: '<US>' })),
      ),
    );
    expect(
      [...redirects, ...rewrites].map(({ condition }) => condition),
    ).toEqual(['<US>', '<US>', '<US>']);
  });

  it.each([
    ['an empty condition', ''],
    ['a number', 1],
  ])('refuses %s', (_why, condition) => {
    expect(() =>
      parseRewrites(JSON.stringify([{ ...AI, condition }, RULE])),
    ).toThrow();
  });

  it.each(REDIRECT_STATUSES)(
    'reads a %s redirect from a plain path, to a path or a URL',
    (status) => {
      const { redirects, rewrites } = parseRewrites(
        rules(
          { source: '/old', status, target: '/new' },
          { source: '/docs', status, target: 'https://example.com/docs' },
          RULE,
        ),
      );
      expect(redirects).toEqual([
        { path: '/old', status, target: '/new' },
        { path: '/docs', status, target: 'https://example.com/docs' },
      ]);
      expect(rewrites).toHaveLength(1);
    },
  );

  it.each([
    ['a 404-200 rule', { ...APEX, source: '/<*>', status: '404-200' }],
    ['a non-http source URL', { ...APEX, source: 'ftp://fooboard.dev' }],
    ['a glob source', { ...APEX, source: '/<*>' }],
    ['a relative target', { ...APEX, target: 'www.fooboard.dev' }],
    ['a malformed target URL', { ...APEX, target: 'https://' }],
  ])('refuses a redirect with %s', (_why, rule) => {
    expect(() => parseRewrites(rules(rule, RULE))).toThrow();
  });

  it.each(['307', '308'])(
    'refuses a %s redirect, which Amplify does not offer, naming its status',
    (status) => {
      expect(() => parseRewrites(rules({ ...APEX, status }, RULE))).toThrow(
        `Status ${status} is not one fooboard reads: a redirect is 301 or 302 (Amplify offers no other), a rewrite 200`,
      );
    },
  );

  it.each([
    [
      'a redirect after a one-path rewrite',
      [AI, APEX, RULE],
      2,
      'a redirect',
      'a one-path rewrite',
    ],
    [
      'a redirect after the SPA rule',
      [RULE, APEX],
      2,
      'a redirect',
      'the SPA rule',
    ],
    [
      'a one-path rewrite after the SPA rule',
      [APEX, RULE, AI],
      3,
      'a one-path rewrite',
      'the SPA rule',
    ],
  ])('refuses %s', (_why, list, n, kind, before) => {
    expect(() => parseRewrites(rules(...list))).toThrow(
      `Rule ${String(n)}, ${kind}, follows ${before}: list the redirects first, then the one-path rewrites, then the SPA rule`,
    );
  });

  it('reads a 200 rewrite to the page from an Amplify regular expression', () => {
    const [rule] = parseRewrites(rules(RULE)).rewrites;
    expect(rule.source.source).toBe('^[^.]+$');
    expect(rule.target).toBe(SPA_ENTRY);
  });

  it('reads a 200 rewrite from one plain path to a file, matching only that path', () => {
    const [rule] = parseRewrites(rules(AI)).rewrites;
    expect(rule.target).toBe('/ai.md');
    expect(rule.source.test('/ai')).toBe(true);
    expect(rule.source.test('/ai/')).toBe(false);
    expect(rule.source.test('/aix')).toBe(false);
    expect(rule.source.test('/x/ai')).toBe(false);
  });

  it('reads a plain source literally, a dot included', () => {
    const [rule] = parseRewrites(
      rules({ source: '/a.b', status: '200', target: '/c.md' }),
    ).rewrites;
    expect(rule.source.test('/a.b')).toBe(true);
    expect(rule.source.test('/axb')).toBe(false);
  });

  it.each([
    ['a glob source', { ...RULE, source: '/<*>' }],
    ['a redirect from a regular expression', { ...RULE, status: '301' }],
    ['another target', { ...RULE, target: '/404.html' }],
    [
      'a plain source rewritten to a path with no extension',
      { source: '/ai', status: '200', target: '/ai' },
    ],
    [
      'a plain source with a wildcard',
      { source: '/ai*', status: '200', target: '/ai.md' },
    ],
  ])('refuses %s', (_why, rule) => {
    expect(() => parseRewrites(rules(rule))).toThrow();
  });

  it('refuses no rules', () => {
    expect(() => parseRewrites('[]')).toThrow();
  });
});

describe('rewrite', () => {
  const two = parseRewrites(
    rules({ ...RULE, source: '</^\\/a$/>' }, { ...RULE, source: '</^\\/b$/>' }),
  ).rewrites;

  it("serves any matching rule's target, else the path itself", () => {
    expect(rewrite(two, '/a')).toBe(SPA_ENTRY);
    expect(rewrite(two, '/b')).toBe(SPA_ENTRY);
    expect(rewrite(two, '/c.js')).toBe('/c.js');
  });
});

describe('hiddenFiles', () => {
  const noDots = parseRewrites(rules(RULE)).rewrites;

  it('lists the files a rule would answer with the page', () => {
    expect(hiddenFiles(noDots, ['/a.js', '/LICENSE', SPA_ENTRY])).toEqual([
      '/LICENSE',
    ]);
  });

  it('lists a file a plain rewrite would answer with another file', () => {
    const plain = parseRewrites(
      rules({ source: '/ai.txt', status: '200', target: '/ai.md' }),
    ).rewrites;
    expect(hiddenFiles(plain, ['/ai.md', '/ai.txt'])).toEqual(['/ai.txt']);
  });
});
