/**
 * Tests for text patterns: each operator matches as the match tests do
 * today (plain ones ignoring case, regex as written), and literal text with
 * syntax characters stays literal under Unicode-mode compilation.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { matchTestMatches } from '@/domain/matching/matchTest';

import { caseless, textPattern } from './pattern';

const matches = (pattern: string, text: string) =>
  new RegExp(pattern, 'u').test(text);

describe('caseless', () => {
  it('turns letters into two-letter classes', () => {
    expect(caseless('Dep1')).toBe('[dD][eE][pP]1');
  });

  it('keeps syntax characters literal, and compiles in Unicode mode', () => {
    const p = caseless('a.b (c)/d-e*');
    expect(matches(p, 'A.B (C)/D-E*')).toBe(true);
    expect(matches(p, 'aXb (c)/d-e*')).toBe(false);
  });
});

describe('textPattern', () => {
  it.each([
    ['is', 'deploy', ['Deploy'], ['deploy prod', 'pre-deploy']],
    ['startsWith', 'deploy', ['Deploy / prod'], ['pre-deploy']],
    ['endsWith', 'test', ['unit TEST'], ['test-e2e']],
    ['contains', 'test', ['e2e-Tests'], ['build']],
    ['regex', '^Deploy', ['Deploy x'], ['deploy x']],
  ] as const)(
    '%s %s agrees with the match tests',
    (operator, value, yes, no) => {
      for (const text of [...yes, ...no]) {
        expect(matches(textPattern(operator, value), text)).toBe(
          matchTestMatches(
            { field: 'jobName', operator, value },
            { jobName: text, workflowName: '' },
          ),
        );
      }
      for (const text of yes)
        expect(matches(textPattern(operator, value), text)).toBe(true);
    },
  );
});
