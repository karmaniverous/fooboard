/**
 * Tests for a column header's tooltip: one pattern when the sources
 * agree (or only one sets a rule), each source labelled when they
 * differ, and the bare name without a pattern.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { always } from '@/domain/rules/always';
import { branchRule } from '@/domain/rules/branch';

import { stageLabel } from './stageLabel';

describe('stageLabel', () => {
  it('shows one pattern when the sources agree', () => {
    const main = branchRule('main');
    expect(
      stageLabel({ name: 'Prod', rules: { github: main, amplify: main } }),
    ).toBe('Prod (main)');
    expect(stageLabel({ name: 'Prod', rules: { amplify: main } })).toBe(
      'Prod (main)',
    );
  });

  it('labels each source when their patterns differ', () => {
    expect(
      stageLabel({
        name: 'Prod',
        rules: {
          github: branchRule('main'),
          amplify: branchRule('production'),
        },
      }),
    ).toBe('Prod (GitHub: main, Amplify: production)');
  });

  it('labels the source of a pattern the other source does not share', () => {
    expect(
      stageLabel({
        name: 'Prod',
        rules: { github: branchRule('main'), amplify: always },
      }),
    ).toBe('Prod (GitHub: main)');
  });

  it('shows only the name without a plain branch rule', () => {
    expect(stageLabel({ name: 'Prod', rules: {} })).toBe('Prod');
    expect(stageLabel({ name: 'Prod', rules: { github: always } })).toBe(
      'Prod',
    );
  });
});
