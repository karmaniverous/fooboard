/**
 * Zod schemas for checks and rules (spec.md A§4.3.7): a check tests the
 * values a JSONPath finds with glob (default), regex or exists, optionally
 * ignoring case, over any or every value, optionally negated; a rule joins
 * checks with AND (default) or OR.
 *
 * @module
 */
import { z } from 'zod';

/** How a check tests a value. */
const CheckOperatorSchema = z.enum(['glob', 'regex', 'exists']);

/** Whether one value the path finds must pass, or all of them. */
const QuantifierSchema = z.enum(['any', 'every']);

/** One check: a JSONPath and a test of the values it finds. */
export const CheckSchema = z.object({
  /** RFC 9535 JSONPath, filters included. */
  path: z.string().min(1),
  operator: CheckOperatorSchema.default('glob'),
  /** The glob or regex; unused by `exists`. */
  value: z.string().default(''),
  /** Glob and regex only. */
  ignoreCase: z.boolean().default(true),
  quantifier: QuantifierSchema.default('any'),
  not: z.boolean().default(false),
});
export type Check = z.infer<typeof CheckSchema>;

/** How a rule joins its checks. */
const CombineSchema = z.enum(['and', 'or']);

/** A rule: checks joined by AND or OR; no checks matches everything. */
export const RuleSchema = z.object({
  combine: CombineSchema.default('and'),
  checks: z.array(CheckSchema).default([]),
});
export type Rule = z.infer<typeof RuleSchema>;
