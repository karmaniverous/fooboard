/**
 * Tests for checks and rules: each operator on scalars, null, objects and
 * arrays; any/every (every failing on nothing); NOT; RFC 9535 filters;
 * checks that can't run never matching (NOT included) and saying why; and
 * AND/OR rules, an empty rule matching everything; and which glob or
 * regex paths find an object or array.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import {
  checkProblem,
  evaluateCheck,
  evaluateRule,
  findsObjectOrArray,
  ruleProblems,
} from './check';
import { MAX_REGEX_LENGTH } from './path';
import { type Check, CheckSchema, RuleSchema } from './schema';

const run = {
  workflow: 'Deploy',
  attempt: 2,
  draft: false,
  conclusion: null,
  meta: { a: 1 },
  items: [
    { name: 'Test (prod)', state: 'failure' },
    { name: 'deploy', state: 'success' },
  ],
};
const check = (c: Partial<Check> & { path: string }) => CheckSchema.parse(c);

describe('evaluateCheck', () => {
  it.each([
    [
      'glob, ignoring case by default',
      { path: '$.workflow', value: 'dep*' },
      true,
    ],
    [
      'glob, case kept',
      { path: '$.workflow', value: 'dep*', ignoreCase: false },
      false,
    ],
    [
      'regex, unanchored',
      { path: '$.workflow', operator: 'regex', value: 'plo' },
      true,
    ],
    ['numbers as text', { path: '$.attempt', value: '2' }, true],
    ['booleans as text', { path: '$.draft', value: 'false' }, true],
    ['null fails glob', { path: '$.conclusion', value: '*' }, false],
    ['objects fail glob', { path: '$.meta', value: '*' }, false],
    ['missing fails', { path: '$.nope', value: '*' }, false],
    [
      'exists ignores null',
      { path: '$.conclusion', operator: 'exists' },
      false,
    ],
    ['exists finds objects', { path: '$.meta', operator: 'exists' }, true],
    ['any item', { path: '$.items[*].state', value: 'failure' }, true],
    [
      'every item',
      { path: '$.items[*].state', value: 'failure', quantifier: 'every' },
      false,
    ],
    [
      'every on nothing fails',
      { path: '$.nope[*]', operator: 'exists', quantifier: 'every' },
      false,
    ],
    ['NOT', { path: '$.conclusion', operator: 'exists', not: true }, true],
    [
      'RFC 9535 filter',
      { path: "$.items[?search(@.name, '[Tt]est')].state", value: 'failure' },
      true,
    ],
  ] as const)('%s', (_, c, expected) => {
    expect(evaluateCheck(check(c), run)).toBe(expected);
  });

  it.each([
    [
      'a path that does not parse',
      { path: '$.items[', value: '*' },
      'path $.items[',
    ],
    ['a non-standard path', { path: '$.a~', operator: 'exists' }, 'path $.a~'],
    [
      'a bad regex',
      { path: '$.workflow', operator: 'regex', value: '(' },
      'regex (',
    ],
    [
      'a long regex',
      {
        path: '$.workflow',
        operator: 'regex',
        value: 'x'.repeat(MAX_REGEX_LENGTH + 1),
      },
      `longer than ${String(MAX_REGEX_LENGTH)}`,
    ],
    [
      'a long filter regex',
      {
        path: `$.items[?match(@.name, '${'x'.repeat(MAX_REGEX_LENGTH + 1)}')]`,
        operator: 'exists',
      },
      `filter regex longer than ${String(MAX_REGEX_LENGTH)}`,
    ],
  ] as const)(
    'never matches with %s, NOT included, and says why',
    (_, c, problem) => {
      expect(evaluateCheck(check(c), run)).toBe(false);
      expect(evaluateCheck(check({ ...c, not: true }), run)).toBe(false);
      expect(checkProblem(check(c))).toContain(problem);
    },
  );

  it('has no problem when the check can run', () => {
    expect(
      checkProblem(check({ path: '$.workflow', value: 'x' })),
    ).toBeUndefined();
  });
});

describe('evaluateRule', () => {
  const deploy = { path: '$.workflow', value: 'Deploy' };
  const build = { path: '$.workflow', value: 'Build' };

  it('matches everything with no checks', () => {
    expect(evaluateRule(RuleSchema.parse({}), run)).toBe(true);
  });

  it('joins checks with AND by default, or OR', () => {
    expect(
      evaluateRule(RuleSchema.parse({ checks: [deploy, build] }), run),
    ).toBe(false);
    expect(
      evaluateRule(
        RuleSchema.parse({ combine: 'or', checks: [deploy, build] }),
        run,
      ),
    ).toBe(true);
  });

  it('lists the problems of its checks', () => {
    const rule = RuleSchema.parse({ checks: [deploy, { path: '$[' }] });
    expect(ruleProblems(rule)).toHaveLength(1);
  });
});

describe('findsObjectOrArray', () => {
  it.each([
    ['an object', { path: '$.meta' }, true],
    ['an array', { path: '$.items' }, true],
    ['objects among several values', { path: '$.items[*]' }, true],
    ['one object among scalars', { path: '$.*', quantifier: 'every' }, true],
    ['a scalar', { path: '$.workflow' }, false],
    ['scalars inside an array', { path: '$.items[*].name' }, false],
    ['null', { path: '$.conclusion' }, false],
    ['nothing', { path: '$.missing' }, false],
    ['an object, with regex', { path: '$.meta', operator: 'regex' }, true],
    ['an object, with exists', { path: '$.meta', operator: 'exists' }, false],
    ['a path that does not parse', { path: '$[' }, false],
  ] as const)('%s: %s', (_, c, expected) => {
    expect(findsObjectOrArray(check(c), [run])).toBe(expected);
  });

  it('looks across every document, and needs one', () => {
    const meta = check({ path: '$.meta' });
    expect(findsObjectOrArray(meta, [{ meta: 'x' }, run])).toBe(true);
    expect(findsObjectOrArray(meta, [])).toBe(false);
  });
});
