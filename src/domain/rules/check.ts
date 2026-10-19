/**
 * Evaluating checks and rules (spec.md A§4.3.7). `null` counts as missing;
 * numbers and booleans are tested as text; objects and arrays only by
 * *exists*. *Every* fails when the path finds nothing. NOT negates a check
 * that could run; a check that can't (bad path, bad or over-long regex)
 * never matches, NOT or not, and is reported by `checkProblem`. Pure.
 *
 * @module
 */
import type { JSONValue } from 'json-p3';

import { globToRegExp } from './glob';
import { compilePath, MAX_REGEX_LENGTH, valuesAt } from './path';
import type { Check, Rule } from './schema';

/** A compiled value test, or why the check can't run. */
type ValueTest =
  | { ok: true; test: (value: JSONValue) => boolean }
  | { ok: false; message: string };

/** A scalar as text; `undefined` for null, objects and arrays. */
function asText(value: JSONValue): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return undefined;
}

const tests = new Map<string, ValueTest>();

function compileTest(check: Check): ValueTest {
  if (check.operator === 'exists')
    return { ok: true, test: (value) => value !== null };
  if (check.operator === 'regex' && check.value.length > MAX_REGEX_LENGTH)
    return {
      ok: false,
      message: `regex longer than ${String(MAX_REGEX_LENGTH)} characters`,
    };
  let pattern: RegExp;
  try {
    pattern =
      check.operator === 'glob'
        ? globToRegExp(check.value, check.ignoreCase)
        : new RegExp(check.value, check.ignoreCase ? 'iu' : 'u');
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
  return {
    ok: true,
    test: (value) => {
      const text = asText(value);
      return text !== undefined && pattern.test(text);
    },
  };
}

function testFor(check: Check): ValueTest {
  const key = `${check.operator}\u0000${String(check.ignoreCase)}\u0000${check.value}`;
  let test = tests.get(key);
  if (!test) {
    test = compileTest(check);
    tests.set(key, test);
  }
  return test;
}

/** Why `check` can't run, or `undefined` when it can. */
export function checkProblem(check: Check): string | undefined {
  const path = compilePath(check.path);
  if (!path.ok) return `path ${check.path}: ${path.message}`;
  const test = testFor(check);
  return test.ok
    ? undefined
    : `${check.operator} ${check.value}: ${test.message}`;
}

/** Does `document` pass `check`? */
export function evaluateCheck(check: Check, document: JSONValue): boolean {
  const path = compilePath(check.path);
  const test = testFor(check);
  if (!path.ok || !test.ok) return false;
  const values = valuesAt(path.query, document);
  const passed =
    check.quantifier === 'any'
      ? values.some(test.test)
      : values.length > 0 && values.every(test.test);
  return check.not ? !passed : passed;
}

/** Does `document` pass `rule`? No checks: always. */
export function evaluateRule(rule: Rule, document: JSONValue): boolean {
  if (rule.checks.length === 0) return true;
  const pass = (c: Check) => evaluateCheck(c, document);
  return rule.combine === 'and'
    ? rule.checks.every(pass)
    : rule.checks.some(pass);
}

/** Every problem in `rule`'s checks. */
export const ruleProblems = (rule: Rule): string[] =>
  rule.checks.flatMap((c) => checkProblem(c) ?? []);
