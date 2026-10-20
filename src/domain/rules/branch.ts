/**
 * Branch rules (spec.md AÂ§4.3.7): the branch presets and the editors'
 * *Branch* field write a stage rule testing `$.branch` with an anchored,
 * case-sensitive regex that keeps branch-pattern meaning (`*` is one or
 * more characters other than `/`, `**` one or more of any), and read a
 * pattern back from a rule that is only that. Pure.
 *
 * @module
 */
import { keyPath, RESERVED_KEYS } from '@/domain/model/keys';

import type { Check, Rule } from './schema';

/** Branch-pattern wildcards: within one segment, and across segments. */
export const STAR = '*';
const DOUBLE_STAR = '**';

/** Their regex forms (both need at least one character, so `release/**`
 * matches `release/24.3` but not the bare `release/`). */
const IN_SEGMENT = '[^/]+';
const ACROSS_SEGMENTS = '.+';

/** The path a branch rule tests. */
const BRANCH_PATH = keyPath(RESERVED_KEYS.branch);

const escape = (text: string): string =>
  text.replace(/[.+?^${}()|[\]\\*]/g, '\\$&');

/** The anchored regex source for branch pattern `pattern`: split on `**`
 * first so it can match across `/`, then `*` within each piece. */
export function branchRegex(pattern: string): string {
  const source = pattern
    .split(DOUBLE_STAR)
    .map((part) => part.split(STAR).map(escape).join(IN_SEGMENT))
    .join(ACROSS_SEGMENTS);
  return `^${source}$`;
}

/** The stage rule for branch pattern `pattern`. */
export const branchRule = (pattern: string): Rule => ({
  combine: 'and',
  checks: [
    {
      path: BRANCH_PATH,
      operator: 'regex',
      value: branchRegex(pattern),
      ignoreCase: false,
      quantifier: 'any',
      not: false,
    },
  ],
});

const isBranchCheck = (c: Check | undefined): c is Check =>
  c !== undefined &&
  c.path === BRANCH_PATH &&
  c.operator === 'regex' &&
  !c.ignoreCase &&
  !c.not &&
  c.quantifier === 'any';

/** The branch pattern `rule` is exactly the rule for, if any. */
export function branchOf(rule: Rule | undefined): string | undefined {
  const [only, ...rest] = rule?.checks ?? [];
  if (rest.length > 0 || !isBranchCheck(only)) return undefined;
  const pattern = only.value
    .replace(/^\^/, '')
    .replace(/\$$/, '')
    .split(ACROSS_SEGMENTS)
    .join(DOUBLE_STAR)
    .split(IN_SEGMENT)
    .join(STAR)
    .replace(/\\(.)/g, '$1');
  return pattern !== '' && branchRegex(pattern) === only.value
    ? pattern
    : undefined;
}
