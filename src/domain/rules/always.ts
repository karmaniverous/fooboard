/**
 * The rule with no checks (spec.md A§4.3.7: a rule with no checks
 * matches everything): the default of every optional rule, and what an
 * emptied rule in an editor means, so it unsets that level's rule and the
 * level above applies. Pure.
 *
 * @module
 */
import type { Rule } from './schema';

/** Matches everything. */
export const always: Rule = { combine: 'and', checks: [] };

/** Does `rule` have no checks, so it matches everything? */
export const isAlways = (rule: Rule): boolean => rule.checks.length === 0;

/** `rule`, or `undefined` when it has no checks (an emptied rule unsets
 * its level's rule). */
export const unlessAlways = (rule: Rule | undefined): Rule | undefined =>
  rule === undefined || isAlways(rule) ? undefined : rule;
