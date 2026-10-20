/**
 * JSONPath for rule checks (spec.md A§4.3.7): RFC 9535 through `json-p3`
 * in strict mode (no extensions, no `eval`). Paths are compiled once and
 * cached; a path that doesn't parse, or whose filter regex is longer than
 * the cap, is reported, never thrown at evaluation.
 *
 * @module
 */
import {
  JSONPathEnvironment,
  type JSONPathQuery,
  type JSONValue,
} from 'json-p3';

import { AST, astChildren, isAstNode } from './jsonPathAst';

/** The path to a whole document. */
export const ROOT_PATH = '$';

/** Longest regex a rule may hold, filter functions included (a bound on
 * what an imported board can make the page do). */
export const MAX_REGEX_LENGTH = 500;

const environment = new JSONPathEnvironment({ strict: true });

/** A compiled path, or why it can't be used. */
export type CompiledPath =
  { ok: true; query: JSONPathQuery } | { ok: false; message: string };

/** The filter functions that take a regex. */
const REGEX_FUNCTIONS = ['match', 'search'];

/** Every regex literal passed to `match()`/`search()` in a parsed path. */
export function filterRegexes(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(filterRegexes);
  if (!isAstNode(node)) return [];
  const own: string[] = [];
  if (
    node.kind === AST.FUNCTION_EXPRESSION &&
    typeof node.name === 'string' &&
    REGEX_FUNCTIONS.includes(node.name) &&
    Array.isArray(node.arguments)
  ) {
    const pattern: unknown = node.arguments[1];
    if (
      isAstNode(pattern) &&
      pattern.kind === AST.STRING_EXPRESSION &&
      typeof pattern.value === 'string'
    )
      own.push(pattern.value);
  }
  const children = astChildren(node).flatMap(filterRegexes);
  return [...own, ...children];
}

function compileUncached(path: string): CompiledPath {
  let query: JSONPathQuery;
  try {
    query = environment.compile(path);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    };
  }
  const long = filterRegexes(query.segments).find(
    (r) => r.length > MAX_REGEX_LENGTH,
  );
  if (long !== undefined)
    return {
      ok: false,
      message: `filter regex longer than ${String(MAX_REGEX_LENGTH)} characters`,
    };
  return { ok: true, query };
}

const cache = new Map<string, CompiledPath>();

/** `path` compiled, from the cache when seen before. */
export function compilePath(path: string): CompiledPath {
  let compiled = cache.get(path);
  if (!compiled) {
    compiled = compileUncached(path);
    cache.set(path, compiled);
  }
  return compiled;
}

/** A key that can follow a dot in a path (`$.state`). */
export const PATH_IDENTIFIER = /^[A-Za-z_]\w*$/;

/** `text` as a single-quoted JSONPath string literal, with quotes and
 * backslashes escaped. */
export const quoted = (text: string): string =>
  `'${text.replace(/[\\']/g, (ch) => `\\${ch}`)}'`;

/** The path segment selecting `key`: `.key`, or `['key']` (quoted)
 * when it isn't an identifier. */
export const pathStep = (key: string): string =>
  PATH_IDENTIFIER.test(key) ? `.${key}` : `[${quoted(key)}]`;

/** `ch` as an I-Regexp class matching it in either case, or `undefined`
 * for a character without case (RFC 9535 regexes have no flag to ignore
 * case). */
export const caseClass = (ch: string): string | undefined =>
  ch.toLowerCase() === ch.toUpperCase()
    ? undefined
    : `[${ch.toUpperCase()}${ch.toLowerCase()}]`;

/** `text` with each letter matching either case. */
export const caseless = (text: string): string =>
  Array.from(text, (ch) => caseClass(ch) ?? ch).join('');

/** The values `query` finds in `document`. */
export const valuesAt = (
  query: JSONPathQuery,
  document: JSONValue,
): JSONValue[] => query.findAll(document);
