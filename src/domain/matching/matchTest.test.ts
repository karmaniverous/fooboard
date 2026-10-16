/**
 * Tests for match-test evaluation (spec.md §3): plain operators are
 * case-insensitive, regex is pattern matching that never throws on an
 * invalid pattern, and a list of tests is OR'd.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import type { MatchTest } from '@/domain/config/matchTest';

import { matchesAny, matchTestMatches } from './matchTest';

const ctx = (jobName: string, workflowName = '') => ({ jobName, workflowName });

describe('matchTestMatches', () => {
  it.each([
    ['is', 'Deploy', 'deploy', true],
    ['is', 'Deploy', 'deploy-x', false],
    ['startsWith', 'Deploy / Deploy', 'deploy', true],
    ['endsWith', 'deploy / Deploy', 'deploy', true],
    ['contains', 'deploy (billing)', 'billing', true],
    ['contains', 'test', 'billing', false],
  ] as const)(
    '%s is case-insensitive: %s vs %s -> %s',
    (operator, jobName, value, expected) => {
      const test: MatchTest = { field: 'jobName', operator, value };
      expect(matchTestMatches(test, ctx(jobName))).toBe(expected);
    },
  );

  it('evaluates regex tests against the field value', () => {
    const test: MatchTest = {
      field: 'jobName',
      operator: 'regex',
      value: '^deploy.*billing',
    };
    expect(matchTestMatches(test, ctx('deploy (billing)'))).toBe(true);
    expect(matchTestMatches(test, ctx('test (billing)'))).toBe(false);
  });

  it('never throws on an invalid regex and never matches', () => {
    const test: MatchTest = {
      field: 'jobName',
      operator: 'regex',
      value: '(unterminated',
    };
    expect(() => matchTestMatches(test, ctx('anything'))).not.toThrow();
    expect(matchTestMatches(test, ctx('anything'))).toBe(false);
  });

  it('selects the field the test is evaluated against', () => {
    const test: MatchTest = {
      field: 'workflowName',
      operator: 'contains',
      value: 'release',
    };
    expect(matchTestMatches(test, ctx('deploy', 'release-pipeline'))).toBe(
      true,
    );
    expect(matchTestMatches(test, ctx('deploy', 'ci'))).toBe(false);
  });
});

describe('matchesAny', () => {
  it('ORs multiple tests on one item', () => {
    const tests: MatchTest[] = [
      { field: 'jobName', operator: 'contains', value: 'deploy' },
      { field: 'jobName', operator: 'contains', value: 'release' },
    ];
    expect(matchesAny(tests, ctx('release-job'), false)).toBe(true);
    expect(matchesAny(tests, ctx('test-job'), false)).toBe(false);
  });

  it('uses emptyResult for an empty test list', () => {
    expect(matchesAny([], ctx('anything'), true)).toBe(true);
    expect(matchesAny([], ctx('anything'), false)).toBe(false);
  });
});
