/**
 * Finds timeouts in Playwright sources that undercut the suite's floor
 * (spec 0.2.0 §3.F; Decision 88): a `timeout:` option or a
 * `test.setTimeout(` argument that is a numeric literal under
 * `MIN_TEST_TIMEOUT_MS`, or an expression that doesn't reference
 * `MIN_TEST_TIMEOUT_MS` (so a product of local constants can't hide a
 * short one). Pauses are not timeouts and are never checked:
 * `page.waitForTimeout(…)` and a plain `setTimeout(` never fail a test.
 *
 * @module
 */
import { MIN_TEST_TIMEOUT_MS } from './timeouts';

/** The constant every non-literal timeout must be built from. */
const FLOOR_NAME = 'MIN_TEST_TIMEOUT_MS';

/** Where a timeout's expression starts: after `timeout:` or
 * `test.setTimeout(`. */
const TIMEOUT_START = /\btimeout\s*:|\btest\.setTimeout\s*\(/g;

/** A plain numeric literal, digit separators allowed. */
const NUMERIC_LITERAL = /^\d[\d_]*$/;

const OPENERS = new Set(['(', '[', '{']);
const CLOSERS = new Set([')', ']', '}']);

/** The expression starting at `from`: up to the first comma, closing
 * bracket or line end outside any bracket it opens itself. */
function expressionAt(source: string, from: number): string {
  let depth = 0;
  let end = from;
  for (; end < source.length; end++) {
    const ch = source.charAt(end);
    if (OPENERS.has(ch)) depth++;
    else if (CLOSERS.has(ch)) {
      if (depth === 0) break;
      depth--;
    } else if (depth === 0 && (ch === ',' || ch === '\n')) break;
  }
  return source.slice(from, end).trim();
}

/** Is `expression` a timeout the floor allows? */
function allowed(expression: string): boolean {
  if (NUMERIC_LITERAL.test(expression))
    return Number(expression.replaceAll('_', '')) >= MIN_TEST_TIMEOUT_MS;
  return expression.includes(FLOOR_NAME);
}

/** Every timeout in `source` the floor refuses, as its expression. */
export function shortTimeouts(source: string): string[] {
  return [...source.matchAll(TIMEOUT_START)]
    .map((match) => expressionAt(source, match.index + match[0].length))
    .filter((expression) => !allowed(expression));
}
