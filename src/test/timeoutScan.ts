/**
 * Finds timeouts in Playwright sources that undercut the suite's floor
 * (spec 0.2.0 §3.F; Decision 88). A timeout is a `timeout`,
 * `actionTimeout` or `navigationTimeout` option, written out or as the
 * shorthand `{ timeout }`, or the argument of a member `setTimeout(`
 * (`test.`, `testInfo.`, `test.info().`), `setDefaultTimeout(` or
 * `setDefaultNavigationTimeout(`. It is refused unless it is a numeric
 * literal of at least `MIN_TEST_TIMEOUT_MS`, the floor itself, or a
 * multiple of it (`k * MIN_TEST_TIMEOUT_MS` or `MIN_TEST_TIMEOUT_MS * k`,
 * with `k` a name or a decimal literal of at least 1, and not `.5` or
 * `0x0`), so a product of local constants or a fraction of the floor
 * can't hide a short one; a shorthand option is always refused, since
 * its value isn't in view.
 * Pauses are not timeouts and are never checked: `page.waitForTimeout(…)`
 * and a plain or `window.` `setTimeout(` never fail a test.
 *
 * @module
 */
import { MIN_TEST_TIMEOUT_MS } from './timeouts';

/** The constant every non-literal timeout must be built from. */
const FLOOR_NAME = 'MIN_TEST_TIMEOUT_MS';

/** Playwright's timeout options. */
const OPTION = '(?:timeout|actionTimeout|navigationTimeout)';

/** Where a timeout's expression starts: after a timeout option's colon,
 * or a timeout setter's opening bracket (a member call, so a pause's
 * plain or `window.` `setTimeout(` isn't one). */
const TIMEOUT_START = new RegExp(
  String.raw`\b${OPTION}\s*:|(?<!\bwindow)\.(?:setTimeout|setDefaultTimeout|setDefaultNavigationTimeout)\s*\(`,
  'g',
);

/** A timeout option written as the shorthand `{ timeout }`. */
const SHORTHAND = new RegExp(String.raw`[{,]\s*(${OPTION})\s*(?=[,}])`, 'g');

/** A decimal literal, its leading digits optional (`.5`), digit
 * separators allowed. */
const NUMERIC_LITERAL = /^(?:\d[\d_]*(?:\.[\d_]*)?|\.\d[\d_]*)$/;

/** A name, or a path of names (`config.retries`). */
const NAME = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/;

/** The floor times a factor, either way round. */
const MULTIPLE = new RegExp(
  String.raw`^(?:[\w.]+\s*\*\s*${FLOOR_NAME}|${FLOOR_NAME}\s*\*\s*[\w.]+)$`,
);

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

/** The value of a numeric literal (digit separators dropped). */
const literalValue = (literal: string): number =>
  Number(literal.replaceAll('_', ''));

/** Is `factor` a name (a count of tries, say) or a decimal literal of at
 * least 1? Anything else (`.5`, `0x0`) is refused. */
const isMultiplier = (factor: string): boolean =>
  NAME.test(factor) ||
  (NUMERIC_LITERAL.test(factor) && literalValue(factor) >= 1);

/** Is `expression` a timeout the floor allows? */
function allowed(expression: string): boolean {
  if (NUMERIC_LITERAL.test(expression))
    return literalValue(expression) >= MIN_TEST_TIMEOUT_MS;
  if (expression === FLOOR_NAME) return true;
  if (!MULTIPLE.test(expression)) return false;
  return isMultiplier(
    expression.replace(FLOOR_NAME, '').replace('*', '').trim(),
  );
}

/** Every timeout in `source` the floor refuses, as its expression, then
 * every shorthand option, as its name. */
export function shortTimeouts(source: string): string[] {
  const written = [...source.matchAll(TIMEOUT_START)]
    .map((match) => expressionAt(source, match.index + match[0].length))
    .filter((expression) => !allowed(expression));
  const shorthand = [...source.matchAll(SHORTHAND)].map((match) => match[1]);
  return [...written, ...shorthand];
}
