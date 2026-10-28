/**
 * What's new's changelog reading and its unseen-version rule (spec.md
 * C-20, §3.10).
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import {
  compareVersions,
  isUnseen,
  parseChangelog,
  type Release,
  withXPosts,
} from './changelog';

/** git-cliff's shape (`cliff.toml`), with an unreleased section on top. */
const CHANGELOG = [
  '# Changelog',
  '',
  'All notable changes to this project will be documented in this file.',
  '',
  '## [unreleased]',
  '',
  '### 🚀 Features',
  '',
  '- Not released yet',
  '',
  '## [0.2.0] - 2026-11-02',
  '',
  '### 🚀 Features',
  '',
  '- *(board)* Gears on every header ([#30](https://github.com/karmaniverous/fooboard/pull/30))',
  '- [**breaking**] Data model v6',
  '',
  '### 🐛 Bug Fixes',
  '',
  '* Keep focus in the popup',
  'A stray line that is not a change',
  '',
  '## [0.1.0]',
  '',
  '- A change before any group is not listed',
  '### 📚 Documentation',
  '   - Indented by the template',
].join('\r\n');

describe('parseChangelog', () => {
  it('reads each release, newest first, without the unreleased section', () => {
    expect(parseChangelog(CHANGELOG)).toEqual([
      {
        version: '0.2.0',
        date: '2026-11-02',
        sections: [
          {
            title: '🚀 Features',
            items: [
              '*(board)* Gears on every header ([#30](https://github.com/karmaniverous/fooboard/pull/30))',
              '[**breaking**] Data model v6',
            ],
          },
          { title: '🐛 Bug Fixes', items: ['Keep focus in the popup'] },
        ],
      },
      {
        version: '0.1.0',
        sections: [
          { title: '📚 Documentation', items: ['Indented by the template'] },
        ],
      },
    ]);
  });

  it('finds no release in a changelog with none (before the first)', () => {
    expect(
      parseChangelog('# Changelog\n\n## [Unreleased]\n\n### Fixes\n\n- x'),
    ).toEqual([]);
  });
});

describe('withXPosts', () => {
  const releases: Release[] = [
    { version: '0.2.0', sections: [] },
    { version: '0.1.0', sections: [] },
    { version: '0.0.9', sections: [] },
  ];

  it("attaches the product account's post, and no other link", () => {
    expect(
      withXPosts(releases, {
        '0.2.0': 'https://x.com/fooboarding/status/1850000000000000000',
        '0.1.0': 'https://x.com/someone-else/status/1850000000000000000',
        '0.0.9': 'javascript:alert(1)',
      }).map((r) => r.xPost),
    ).toEqual([
      'https://x.com/fooboarding/status/1850000000000000000',
      undefined,
      undefined,
    ]);
  });
});

describe('compareVersions', () => {
  it.each([
    ['0.1.0', '0.1.0', 0],
    ['0.1.1', '0.1.0', 1],
    ['0.2.0', '0.1.9', 1],
    ['1.0.0', '0.99.99', 1],
    ['0.10.0', '0.9.0', 1],
    ['0.1.0', '0.1.0-0', 1],
    ['0.1.0-1', '0.1.0-0', 1],
    ['0.1.0-10', '0.1.0-9', 1],
    ['0.1.0-beta', '0.1.0-alpha', 1],
    ['0.1.0-alpha', '0.1.0-1', 1],
    ['0.1.0-alpha.1', '0.1.0-alpha', 1],
    ['0.1.0+build.2', '0.1.0+build.1', 0],
  ])('orders %s against %s as %i', (a, b, sign) => {
    expect(Math.sign(compareVersions(a, b) ?? Number.NaN)).toBe(sign);
    expect(Math.sign(compareVersions(b, a) ?? Number.NaN)).toBe(-sign || 0);
  });

  it.each([
    ['v0.1.0', '0.1.0'],
    ['0.1', '0.1.0'],
    ['0.1.0', 'next'],
  ])('has no order for %s and %s', (a, b) => {
    expect(compareVersions(a, b)).toBeUndefined();
  });
});

describe('isUnseen', () => {
  it.each([
    ['nothing seen yet', '0.1.0', undefined, true],
    ['the newest seen', '0.1.0', '0.1.0', false],
    ['an older one seen', '0.2.0', '0.1.0', true],
    ['a newer one seen (an older site)', '0.1.0', '0.2.0', false],
    ['a prerelease seen, then its release', '0.1.0', '0.1.0-0', true],
    ['no release in the bundle', undefined, undefined, false],
    ['no release in the bundle, one seen', undefined, '0.1.0', false],
    ['an unparsable seen value', '0.1.0', 'garbage', true],
    ['the same unparsable value', 'next', 'next', false],
  ])('%s', (_, newest, lastSeen, unseen) => {
    expect(isUnseen(newest, lastSeen)).toBe(unseen);
  });
});
