/**
 * Translating raw data into a record (spec.md A§4.3.7). A record is the
 * JSON document later rules see: its keys, `items` (when the source rule
 * has an items path) and the raw data under `_raw`. A key no translation
 * matches is `null` (missing) and reported; a copy finding several values
 * uses the first and is reported. Pure.
 *
 * @module
 */
import type { JSONValue } from 'json-p3';

import { evaluateRule } from '@/domain/rules/check';
import { compilePath, valuesAt } from '@/domain/rules/path';

import { isJsonObject } from './json';
import type { KeyDef, SourceRule } from './sourceRule';

/** A translated record or item: its keys (and, for records, `items` and
 * `_raw`). */
export type RecordDoc = Record<string, JSONValue>;

/** A key that couldn't be translated cleanly. */
export interface KeyProblem {
  key: string;
  scope: 'record' | 'item';
  kind: 'untranslated' | 'multiple-values';
  /** The raw record or item it happened on. */
  sample: JSONValue;
}

function translateKeys(
  keys: readonly KeyDef[],
  raw: JSONValue,
  scope: KeyProblem['scope'],
  problems: KeyProblem[],
): RecordDoc {
  const out: RecordDoc = {};
  for (const key of keys) {
    const hit = key.translations.find((t) => evaluateRule(t.rule, raw));
    if (!hit) {
      out[key.name] = null;
      problems.push({
        key: key.name,
        scope,
        kind: 'untranslated',
        sample: raw,
      });
      continue;
    }
    if ('value' in hit) {
      out[key.name] = hit.value;
      continue;
    }
    const path = compilePath(hit.copy);
    const values = path.ok ? valuesAt(path.query, raw) : [];
    if (values.length > 1)
      problems.push({
        key: key.name,
        scope,
        kind: 'multiple-values',
        sample: raw,
      });
    out[key.name] = values[0] ?? null;
  }
  return out;
}

/** `raw` translated by `rule`, with any key problems. */
export function translate(
  rule: SourceRule,
  raw: JSONValue,
): { record: RecordDoc; problems: KeyProblem[] } {
  const problems: KeyProblem[] = [];
  const record = translateKeys(rule.keys, raw, 'record', problems);
  if (rule.items) {
    const path = compilePath(rule.items.path);
    const rawItems = path.ok ? valuesAt(path.query, raw) : [];
    const { keys } = rule.items;
    record.items = rawItems.map((item) =>
      translateKeys(keys, item, 'item', problems),
    );
  }
  record._raw = raw;
  return { record, problems };
}

/** The items of a translated record (none when its source has none). */
export const itemsOf = (record: RecordDoc): RecordDoc[] => {
  const items = record.items;
  return Array.isArray(items) ? items.filter(isJsonObject) : [];
};

/** Does `record`'s source have items? */
export const hasItems = (record: RecordDoc): boolean =>
  Array.isArray(record.items);

/** Compare two order-key (or item time) values: numbers as numbers,
 * anything else as text; `null` sorts first. */
export function compareOrder(a: JSONValue, b: JSONValue): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? -1 : 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  const x = typeof a === 'string' ? a : JSON.stringify(a);
  const y = typeof b === 'string' ? b : JSON.stringify(b);
  return x < y ? -1 : x > y ? 1 : 0;
}
