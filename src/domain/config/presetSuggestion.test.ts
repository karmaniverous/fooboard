/**
 * Tests for the first run's stage suggestion: the best-fitting branch
 * preset for the branches found, ties, nothing matching, and the preview
 * names `preview/*` branches give.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { previewNames, suggestPreset } from './presetSuggestion';

const repos = (...branches: string[][]) =>
  new Map(branches.map((names, i) => [`acme/r${String(i)}`, names]));

describe('suggestPreset', () => {
  it.each([
    [
      'environment branches',
      repos(['dev', 'staging', 'main'], ['dev', 'staging', 'main']),
      'env-branches',
    ],
    [
      'gitflow',
      repos(['develop', 'release/1.2', 'main'], ['develop', 'main']),
      'gitflow-ish',
    ],
    [
      'release train, by its release branches',
      repos(['dev', 'release/24.3', 'main'], ['dev', 'main']),
      'previews-release-train',
    ],
    [
      'release train, by its preview branches',
      repos(['dev', 'main', 'preview/bali'], ['dev', 'main', 'preview/texas']),
      'previews-release-train',
    ],
    [
      'environment branches over a stray preview branch in one repo of two',
      repos(['dev', 'staging', 'main', 'preview/bali'], ['dev', 'staging']),
      'env-branches',
    ],
  ])('suggests %s', (_, byRepo, expected) => {
    expect(suggestPreset(byRepo).presetId).toBe(expected);
  });

  it('breaks a tie on fewer stages matching nothing, then on order', () => {
    // Both score 2: environment branches leave dev and prod empty,
    // gitflow only prod.
    expect(
      suggestPreset(repos(['staging', 'develop'], ['staging', 'release/1']))
        .presetId,
    ).toBe('gitflow-ish');
    // dev + main: environment branches and the release train both score
    // 2 and leave one stage empty, so the first listed wins.
    expect(suggestPreset(repos(['dev', 'main'])).presetId).toBe('env-branches');
  });

  it('suggests a blank dashboard when no branch matches any preset', () => {
    expect(suggestPreset(repos(['master', 'trunk']))).toEqual({
      presetId: 'custom',
      previewNames: [],
    });
    expect(suggestPreset(new Map()).presetId).toBe('custom');
  });

  it('offers the preview names whichever preset is suggested', () => {
    expect(
      suggestPreset(repos(['dev', 'staging', 'main', 'preview/bali'])),
    ).toEqual({ presetId: 'env-branches', previewNames: ['bali'] });
  });
});

describe('previewNames', () => {
  it('names one preview per preview/<name> branch, most common first', () => {
    expect(
      previewNames(
        repos(
          ['preview/texas', 'preview/bali', 'dev'],
          ['preview/bali', 'preview/bali'],
          ['preview/alpha'],
        ),
      ),
    ).toEqual(['bali', 'alpha', 'texas']);
  });

  it('skips nested and empty names, and names the preset already gives', () => {
    expect(
      previewNames(
        repos([
          'preview/a/b',
          'preview/',
          'preview/release',
          'preview/dev',
          'previews/x',
          'feature/preview/y',
          'preview/ok',
        ]),
      ),
    ).toEqual(['ok']);
  });
});
