/**
 * Match-test evaluation (spec.md §3): `field · operator · value`. Plain
 * operators (`is`, `startsWith`, `endsWith`, `contains`) are
 * case-insensitive; `regex` is case-sensitive, and an invalid pattern
 * matches nothing and never throws. A list of tests on one item is OR'd.
 * Pure; no network.
 *
 * @module
 */
import type { MatchField, MatchTest } from '@/domain/config/matchTest';

/** The candidate values a match test can be evaluated against. */
export type MatchContext = Record<MatchField, string>;

function evaluatePlain(
  operator: string,
  value: string,
  against: string,
): boolean {
  const a = against.toLowerCase();
  const v = value.toLowerCase();
  switch (operator) {
    case 'is':
      return a === v;
    case 'startsWith':
      return a.startsWith(v);
    case 'endsWith':
      return a.endsWith(v);
    case 'contains':
      return a.includes(v);
    default:
      return false;
  }
}

function evaluateRegex(value: string, against: string): boolean {
  try {
    return new RegExp(value).test(against);
  } catch {
    return false;
  }
}

/** Does `test` match the given context? */
export function matchTestMatches(
  test: MatchTest,
  context: MatchContext,
): boolean {
  const against = context[test.field];
  if (test.operator === 'regex') return evaluateRegex(test.value, against);
  return evaluatePlain(test.operator, test.value, against);
}

/**
 * Do any of `tests` match the context (OR'd, spec.md §3)? `emptyResult`
 * controls the result for an empty list, since callers differ: workflow
 * filter `include` treats empty as "include all" (`true`), while row key
 * tests and `exclude` treat empty as "no match" (`false`).
 */
export function matchesAny(
  tests: readonly MatchTest[],
  context: MatchContext,
  emptyResult: boolean,
): boolean {
  if (tests.length === 0) return emptyResult;
  return tests.some((test) => matchTestMatches(test, context));
}
