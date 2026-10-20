/**
 * Globs for rule checks (spec.md A§4.3.7): the whole value must match; `*`
 * is any run of characters (including `/`), `?` one character, `[abc]` one
 * of a set (`[!abc]` none of it), `{a,b}` either alternative (nestable). A
 * glob without wildcards is an exact match. An unclosed `[` or `{` is
 * literal. Pure.
 *
 * One translation serves glob checks and JSONPath filters (*only items
 * where*): an I-Regexp body (RFC 9485, as RFC 9535 `match()` takes it)
 * that JavaScript reads the same way. So it has no lookarounds and no
 * flags: ignoring case folds each letter into a class (`caseClass`).
 *
 * @module
 */
import { unique } from 'radash';

import { caseClass } from './path';

/** Any one character, line breaks included. Not `.`, whose line handling
 * differs between I-Regexp and JavaScript, nor `[\s\S]`, which I-Regexp
 * lacks. */
const ANY_CHAR = '([^\\n]|\\n)';
/** Characters escaped with a backslash outside a set. */
const SYNTAX = /[\\^.*+?()[\]{}|]/;
/** `$` is an anchor to JavaScript but has no I-Regexp escape: a set. */
const DOLLAR = '$';
const DOLLAR_SET = '[$]';
/** Characters escaped with a backslash in a set (ranges are written out
 * separately, so a member `-` is always literal). */
const SET_SYNTAX = /[\\^[\]-]/;
/** The marks of a negated set and of a range in a glob. */
const NEGATE = '!';
const RANGE = '-';

function literal(c: string, ignoreCase: boolean): string {
  const folded = ignoreCase ? caseClass(c) : undefined;
  if (folded !== undefined) return folded;
  if (c === DOLLAR) return DOLLAR_SET;
  return SYNTAX.test(c) ? `\\${c}` : c;
}

const member = (c: string): string => (SET_SYNTAX.test(c) ? `\\${c}` : c);

const single = (text: string): boolean => Array.from(text).length === 1;

/** `c` and, when ignoring case, its single-character case forms. */
const forms = (c: string, ignoreCase: boolean): string[] =>
  ignoreCase
    ? unique([c, c.toUpperCase(), c.toLowerCase()].filter(single))
    : [c];

/** The range `from-to` and, when ignoring case, its upper- and lower-case
 * forms (where both ends have one, in order). */
function ranges(from: string, to: string, ignoreCase: boolean): string[] {
  const folds = ignoreCase
    ? [
        [from.toUpperCase(), to.toUpperCase()],
        [from.toLowerCase(), to.toLowerCase()],
      ].filter(
        ([a = '', b = '']) =>
          single(a) &&
          single(b) &&
          (a.codePointAt(0) ?? 0) <= (b.codePointAt(0) ?? 0),
      )
    : [];
  return unique(
    [[from, to], ...folds].map(
      ([a = '', b = '']) => `${member(a)}-${member(b)}`,
    ),
  );
}

/** A set's members as an I-Regexp class body: single characters and
 * `a-z` ranges, each in both cases when ignoring case. */
function setBody(members: readonly string[], ignoreCase: boolean): string {
  let body = '';
  for (let k = 0; k < members.length; k += 1) {
    const from = members[k] ?? '';
    const to = members[k + 1] === RANGE ? members[k + 2] : undefined;
    if (to === undefined) {
      body += forms(from, ignoreCase).map(member).join('');
      continue;
    }
    k += 2;
    body += ranges(from, to, ignoreCase).join('');
  }
  return body;
}

/** The I-Regexp body for `glob[from, …)`, stopping at a top-level `stop`
 * character when given. Returns the body and where it stopped. */
function translate(
  glob: readonly string[],
  from: number,
  stops: readonly string[],
  ignoreCase: boolean,
): { source: string; end: number } {
  let source = '';
  let i = from;
  while (i < glob.length) {
    const c = glob[i] ?? '';
    if (stops.includes(c)) return { source, end: i };
    if (c === '*') source += `${ANY_CHAR}*`;
    else if (c === '?') source += ANY_CHAR;
    else if (c === '[') {
      const close = glob.indexOf(']', i + 2);
      if (close < 0) source += literal(c, ignoreCase);
      else {
        const negate = glob[i + 1] === NEGATE;
        const members = glob.slice(negate ? i + 2 : i + 1, close);
        source += `[${negate ? '^' : ''}${setBody(members, ignoreCase)}]`;
        i = close;
      }
    } else if (c === '{') {
      const alternatives = braces(glob, i, ignoreCase);
      if (alternatives) {
        source += `(${alternatives.sources.join('|')})`;
        i = alternatives.end;
      } else source += literal(c, ignoreCase);
    } else source += literal(c, ignoreCase);
    i += 1;
  }
  return { source, end: i };
}

/** `{a,b}` starting at `open`: each alternative's body and the index of
 * the closing brace, or `undefined` if it never closes. */
function braces(
  glob: readonly string[],
  open: number,
  ignoreCase: boolean,
): { sources: string[]; end: number } | undefined {
  const sources: string[] = [];
  let i = open + 1;
  for (;;) {
    const part = translate(glob, i, [',', '}'], ignoreCase);
    sources.push(part.source);
    if (part.end >= glob.length) return undefined;
    if (glob[part.end] === '}') return { sources, end: part.end };
    i = part.end + 1;
  }
}

/** A glob matching exactly `text` (wildcard characters as sets). */
export const escapeGlob = (text: string): string =>
  text.replace(/[*?[\]{}]/g, (c) => `[${c}]`);

/** `glob` as an I-Regexp body for RFC 9535 `match()` (which matches the
 * whole value, so it carries no anchors). */
export const globToIRegexp = (glob: string, ignoreCase: boolean): string =>
  translate(glob.match(/./gsu) ?? [], 0, [], ignoreCase).source;

/** The anchored regex for `glob`: the same body, read by JavaScript. */
export const globToRegExp = (glob: string, ignoreCase: boolean): RegExp =>
  new RegExp(`^(?:${globToIRegexp(glob, ignoreCase)})$`, 'u');
