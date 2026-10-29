/**
 * The Markdown docs are clean UTF-8: no mojibake from a Windows-1252 round
 * trip (README.md once had eighteen lines of it, which Prettier doesn't
 * see), and the scan that says so catches each kind while leaving the
 * docs' real symbols alone.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { mojibakeIn } from './test/mojibake';

/** Every Markdown file in the repo: the root's, `.github`'s and any
 * under a source folder (the glob skips `node_modules` and dot folders,
 * so `.github` is named). */
const docs = import.meta.glob<string>(['/**/*.md', '/.github/**/*.md'], {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('the mojibake scan', () => {
  it.each([
    ['×', 'Ã—'],
    ['…', 'â€¦'],
    ['’', 'â€™'],
    ['←', 'â†\u0090'],
    ['✓', 'âœ“'],
    ['⚙', 'âš™'],
    ['·', 'Â·'],
    ['📷', 'ðŸ“·'],
  ])('finds %s garbled as %s', (_char, garbled) => {
    expect(mojibakeIn(`repo ${garbled} stage`)).not.toEqual([]);
  });

  it('finds a C1 control character on its own', () => {
    expect(mojibakeIn('dev \u0090 main')).toEqual(['\u0090']);
  });

  it('leaves real symbols and accented prose alone', () => {
    expect(
      mojibakeIn('repo × stage, file…, ← → ✓ ✕ ◔ ⚙ ⌘ 📷, the café’s naïve—'),
    ).toEqual([]);
  });
});

describe('the Markdown docs', () => {
  it('include the user and contributor docs', () => {
    expect(Object.keys(docs)).toEqual(
      expect.arrayContaining([
        '/README.md',
        '/CONTRIBUTING.md',
        '/PRIVACY.md',
        '/TERMS.md',
        '/AGENTS.md',
        '/.github/copilot-instructions.md',
      ]),
    );
  });

  it.each(Object.entries(docs))('%s has no mojibake', (_path, text) => {
    expect(mojibakeIn(text)).toEqual([]);
  });
});
