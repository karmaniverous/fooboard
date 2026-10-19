/**
 * Shorthand for writing the built-in rules: checks, rules and
 * translations. Pure.
 *
 * @module
 */
import { type Check, CheckSchema, type Rule } from '@/domain/rules/schema';

import type { Translation } from './sourceRule';

/** A check, defaults filled in. */
export const check = (c: Partial<Check> & { path: string }): Check =>
  CheckSchema.parse(c);

/** A glob check (`{a,b}` alternatives allowed). */
export const is = (path: string, value: string): Check =>
  check({ path, value });

/** An exists check. */
export const exists = (path: string): Check =>
  check({ path, operator: 'exists' });

/** Checks joined by AND. */
export const all = (...checks: Check[]): Rule => ({ combine: 'and', checks });

/** Checks joined by OR. */
export const any = (...checks: Check[]): Rule => ({ combine: 'or', checks });

/** Matches everything. */
export const always: Rule = { combine: 'and', checks: [] };

/** Give `value` when `rule` matches. */
export const give = (value: string, rule: Rule = always): Translation => ({
  rule,
  value,
});

/** Copy the value at `path` when it exists (not null). */
export const copy = (path: string): Translation => ({
  rule: all(exists(path)),
  copy: path,
});

/** Negate a check. */
export const not = (c: Check): Check => ({ ...c, not: true });
