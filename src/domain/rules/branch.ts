/**
 * Branch rules (spec.md A§4.3.7): the branch presets and the editors'
 * *Branch* field write a stage rule testing `$.branch` with an anchored,
 * case-sensitive regex that keeps branch-pattern meaning (`*` is one or
 * more characters other than `/`, `**` one or more of any), and read a
 * pattern back from a rule that is only that. Pure.
 *
 * @module
 */
import type { Check, Rule } from './schema';

const escape = (text: string): string =>
  text.replace(/[.+?^${}()|[\]\\*]/g, '\\$&');

/** The anchored regex for branch pattern `pattern`. */
function branchRegex(pattern: string): string {
  const source = pattern
    .split('**')
    .map((part) => part.split('*').map(escape).join('[^/]+'))
    .join('.+');
  return `^${source}$`;
}

/** The stage rule for branch pattern `pattern`. */
export const branchRule = (pattern: string): Rule => ({
  combine: 'and',
  checks: [
    {
      path: '$.branch',
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
  c.path === '$.branch' &&
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
    .replace(/\.\+/g, '**')
    .replace(/\[\^\/\]\+/g, '*')
    .replace(/\\(.)/g, '$1');
  return pattern !== '' && branchRegex(pattern) === only.value
    ? pattern
    : undefined;
}
