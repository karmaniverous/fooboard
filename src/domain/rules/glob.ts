/**
 * Globs for rule checks (spec.md A§4.3.7): the whole value must match; `*`
 * is any run of characters (including `/`), `?` one character, `[abc]` one
 * of a set (`[!abc]` none of it), `{a,b}` either alternative (nestable). A
 * glob without wildcards is an exact match. An unclosed `[` or `{` is
 * literal. Pure.
 *
 * @module
 */

/** Characters with meaning in a regex (the only ones `u` mode escapes). */
const SYNTAX = /[\\^$.*+?()[\]{}|/]/;
const escape = (c: string): string => (SYNTAX.test(c) ? `\\${c}` : c);
/** In a set, `-` keeps its range meaning (`[a-z]`). */
const escapeMember = (c: string): string => (/[\\^[\]]/.test(c) ? `\\${c}` : c);

/** The regex source for `glob[from, to)`, stopping at a top-level `stop`
 * character when given. Returns the source and where it stopped. */
function translate(
  glob: readonly string[],
  from: number,
  stops: readonly string[],
): { source: string; end: number } {
  let source = '';
  let i = from;
  while (i < glob.length) {
    const c = glob[i] ?? '';
    if (stops.includes(c)) return { source, end: i };
    if (c === '*') source += '[\\s\\S]*';
    else if (c === '?') source += '[\\s\\S]';
    else if (c === '[') {
      const close = glob.indexOf(']', i + 2);
      if (close < 0) source += '\\[';
      else {
        const negate = glob[i + 1] === '!';
        const members = glob.slice(negate ? i + 2 : i + 1, close);
        source += `[${negate ? '^' : ''}${members.map(escapeMember).join('')}]`;
        i = close;
      }
    } else if (c === '{') {
      const alternatives = braces(glob, i);
      if (alternatives) {
        source += `(?:${alternatives.sources.join('|')})`;
        i = alternatives.end;
      } else source += '\\{';
    } else source += escape(c);
    i += 1;
  }
  return { source, end: i };
}

/** `{a,b}` starting at `open`: each alternative's source and the index of
 * the closing brace, or `undefined` if it never closes. */
function braces(
  glob: readonly string[],
  open: number,
): { sources: string[]; end: number } | undefined {
  const sources: string[] = [];
  let i = open + 1;
  for (;;) {
    const part = translate(glob, i, [',', '}']);
    sources.push(part.source);
    if (part.end >= glob.length) return undefined;
    if (glob[part.end] === '}') return { sources, end: part.end };
    i = part.end + 1;
  }
}

/** The anchored regex for `glob`. */
export function globToRegExp(glob: string, ignoreCase: boolean): RegExp {
  const { source } = translate(glob.match(/./gsu) ?? [], 0, []);
  return new RegExp(`^${source}$`, ignoreCase ? 'iu' : 'u');
}
