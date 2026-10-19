/**
 * What a path names (spec.md A§4.3.7 *Consistency*), read from its parsed
 * form segment by segment, filters included: `$.state` names record key
 * `state`; `$.items[?search(@.name, 'x')].state` names item keys `name`
 * and `state` (relative paths in a filter are item paths; absolute ones
 * record paths). A path that goes on inside a key (`$.state.x`) says so,
 * for the caller to judge against how the key is made. What can't be
 * decided is listed as unchecked, not guessed: anything under `_raw`,
 * wildcards and descendant segments past the known keys. Pure.
 *
 * @module
 */
import { compilePath } from './path';

/** json-p3 AST kinds (its `ast.d.ts`). */
const CHILD = 1;
const FILTER = 3;
const INDEX = 4;
const NAME = 8;
const SLICE = 9;
const WILDCARD = 10;
const ABSOLUTE_QUERY = 11;
const RELATIVE_QUERY = 26;
/** Selectors that step into an array's elements. */
const ELEMENTS = [FILTER, INDEX, SLICE, WILDCARD];

export interface NamedKey {
  scope: 'record' | 'item';
  name: string;
}

export interface PathRefs {
  /** Keys the path names. */
  keys: NamedKey[];
  /** Keys the path goes on inside (`$.state.x` inside `state`). */
  inside: NamedKey[];
  /** Why parts of the path can't be checked. */
  unchecked: string[];
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

/** The single selector of a child segment, if it is one. */
function only(segment: unknown): Record<string, unknown> | undefined {
  if (!isRecord(segment) || segment.kind !== CHILD) return undefined;
  const selectors = segment.selectors;
  if (!Array.isArray(selectors) || selectors.length !== 1) return undefined;
  const selector: unknown = selectors[0];
  return isRecord(selector) ? selector : undefined;
}

const nameOf = (segment: unknown): string | undefined => {
  const s = only(segment);
  return s?.kind === NAME && typeof s.value === 'string' ? s.value : undefined;
};

/** Why a segment that isn't a plain name can't be checked. */
const why = (segment: unknown): string =>
  isRecord(segment) && segment.kind !== CHILD
    ? 'a descendant segment'
    : only(segment)?.kind === WILDCARD
      ? 'a wildcard'
      : 'a selector past the known keys';

/** Queries inside a filter expression: relative (`@`) and absolute (`$`). */
function queries(node: unknown): { relative: boolean; segments: unknown[] }[] {
  if (Array.isArray(node)) return node.flatMap(queries);
  if (!isRecord(node)) return [];
  if (
    (node.kind === RELATIVE_QUERY || node.kind === ABSOLUTE_QUERY) &&
    Array.isArray(node.segments)
  )
    return [
      { relative: node.kind === RELATIVE_QUERY, segments: node.segments },
    ];
  return Object.entries(node)
    .filter(([k]) => k !== 'token')
    .flatMap(([, v]) => queries(v));
}

function walk(
  segments: readonly unknown[],
  scope: NamedKey['scope'],
  refs: PathRefs,
): void {
  const [first, second, ...rest] = segments;
  if (first === undefined) return;
  const head = nameOf(first);
  if (head === undefined) {
    refs.unchecked.push(why(first));
    return;
  }
  if (scope === 'record' && head === '_raw') {
    if (second !== undefined) refs.unchecked.push('a path under _raw');
    return;
  }
  const key = { scope, name: head };
  refs.keys.push(key);
  if (second === undefined) return;
  if (scope === 'item' || head !== 'items') {
    refs.inside.push(key);
    return;
  }
  const step = only(second);
  if (!step || !ELEMENTS.includes(Number(step.kind))) {
    refs.unchecked.push(why(second));
    return;
  }
  if (step.kind === FILTER)
    for (const q of queries(step.expression))
      walk(q.segments, q.relative ? 'item' : 'record', refs);
  walk(rest, 'item', refs);
}

/** What `path` names when `$` is a record (or, for `scope` item, an
 * item); `undefined` for a path that doesn't parse. */
export function pathRefs(
  path: string,
  scope: NamedKey['scope'],
): PathRefs | undefined {
  const compiled = compilePath(path);
  if (!compiled.ok) return undefined;
  const refs: PathRefs = { keys: [], inside: [], unchecked: [] };
  walk(compiled.query.segments, scope, refs);
  return refs;
}
