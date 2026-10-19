/**
 * The record and item keys a path names (spec.md A§4.3.7 *Consistency*),
 * read from its parsed form, filters included: `$.state` names record key
 * `state`; `$.items[?search(@.name, 'x')].state` names item keys `name`
 * and `state`. What can't be decided (descendant segments, keys after a
 * wildcard past the known keys, anything under `_raw`) is left unchecked,
 * not reported. Pure.
 *
 * @module
 */
import { compilePath } from './path';

/** json-p3 AST kinds (its `ast.d.ts`). */
const CHILD = 1;
const NAME = 8;
const FILTER = 3;
const WILDCARD = 10;
const INDEX = 4;
const RELATIVE_QUERY = 26;

export interface NamedKey {
  scope: 'record' | 'item';
  name: string;
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

/** The first names of every relative query (`@.name`) in a filter. */
function relativeNames(node: unknown): string[] {
  if (Array.isArray(node)) return node.flatMap(relativeNames);
  if (!isRecord(node)) return [];
  if (node.kind === RELATIVE_QUERY && Array.isArray(node.segments)) {
    const first = nameOf(node.segments[0]);
    return first === undefined ? [] : [first];
  }
  return Object.entries(node)
    .filter(([k]) => k !== 'token')
    .flatMap(([, v]) => relativeNames(v));
}

/** Keys `path` names when `$` is a record (or, for `scope` item, an
 * item); `undefined` for a path that doesn't parse. */
export function pathKeys(
  path: string,
  scope: NamedKey['scope'],
): NamedKey[] | undefined {
  const compiled = compilePath(path);
  if (!compiled.ok) return undefined;
  const [first, second, third]: unknown[] = compiled.query.segments;
  const head = nameOf(first);
  if (head === undefined) return [];
  if (scope === 'item') return [{ scope: 'item', name: head }];
  if (head === '_raw') return [];
  const keys: NamedKey[] = [{ scope: 'record', name: head }];
  if (head !== 'items') return keys;
  const step = only(second);
  if (step?.kind === FILTER)
    keys.push(
      ...relativeNames(step.expression).map((name) => ({
        scope: 'item' as const,
        name,
      })),
    );
  if (step && [FILTER, WILDCARD, INDEX].includes(Number(step.kind))) {
    const itemKey = nameOf(third);
    if (itemKey !== undefined) keys.push({ scope: 'item', name: itemKey });
  }
  return keys;
}
