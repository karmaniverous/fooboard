/**
 * Text tests as standard JSON Schema `pattern`s (spec.md A§4.3.6). The
 * plain operators ignore case, which JSON Schema has no flag for, so each
 * letter becomes a two-letter class (`deploy` → `[dD][eE][pP][lL][oO][yY]`):
 * every schema stays standard and behaves the same in any validator.
 * Patterns are compiled in Unicode mode (`u`), so only syntax characters
 * are escaped. `regex` passes through, case-sensitive, as today.
 *
 * @module
 */
import type { MatchOperator } from '@/domain/config/matchTest';

/** Characters with meaning in a pattern (the only ones `u` mode lets us
 * escape). */
const SYNTAX = /[\\^$.*+?()[\]{}|/]/;

/** `text` matched literally, ignoring case. */
export function caseless(text: string): string {
  // Per code point (the `u` flag), so astral characters stay whole.
  return text.replace(/./gsu, (c) => {
    const lower = c.toLowerCase();
    const upper = c.toUpperCase();
    if (lower !== upper && lower.length === 1 && upper.length === 1)
      return `[${lower}${upper}]`;
    return SYNTAX.test(c) ? `\\${c}` : c;
  });
}

/** The pattern for one text test (an unanchored search, as JSON Schema's
 * `pattern` is). */
export function textPattern(operator: MatchOperator, value: string): string {
  switch (operator) {
    case 'is':
      return `^${caseless(value)}$`;
    case 'startsWith':
      return `^${caseless(value)}`;
    case 'endsWith':
      return `${caseless(value)}$`;
    case 'contains':
      return caseless(value);
    case 'regex':
      return value;
  }
}
