/**
 * A rule in words (spec.md A§4.3.7): each check as "path matches value",
 * "path exists" or its NOT, joined by the rule's AND or OR; an empty rule
 * matches everything. Pure.
 *
 * @module
 */
import { isAlways } from './always';
import type { Check, Rule } from './schema';

/** One check in words. */
export const describeCheck = (c: Check): string =>
  `${c.not ? 'NOT ' : ''}${c.path} ${c.operator === 'exists' ? 'exists' : `matches ${c.value}`}`;

/** A rule in words; `everything` names what an empty rule matches. */
export const describeRule = (rule: Rule, everything: string): string =>
  isAlways(rule)
    ? everything
    : rule.checks
        .map(describeCheck)
        .join(rule.combine === 'and' ? ' and ' : ' or ');
