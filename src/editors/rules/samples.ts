/**
 * Real records for the rule editors (spec.md A§4.3.7): the board's current
 * cell records, per source, so a rule can preview what it matches and the
 * field picker can offer the paths those records have. Pure, except the
 * context.
 *
 * @module
 */
import type { JSONValue } from 'json-p3';
import { createContext, useContext } from 'react';

import { UNKNOWN_STATUS_ID } from '@/domain/config/statusSets';
import type { RecordDoc } from '@/domain/model/translate';
import { compilePath, valuesAt } from '@/domain/rules/path';

export type SampleProvider = 'github' | 'amplify';

export type RuleSamples = Partial<Record<SampleProvider, readonly RecordDoc[]>>;

export const RuleSamplesContext = createContext<RuleSamples>({});

/** The sources whose source rule reads items (spec.md A§4.3.7: item
 * rules and *Only items where* are offered only for those). */
export const SourcesWithItemsContext = createContext<readonly SampleProvider[]>(
  ['github'],
);

/** Entries of the Amplify branch lists read, for the branch rule. */
export const BranchSamplesContext = createContext<readonly JSONValue[]>([]);

/** The board's records for `provider` (none outside a board). */
export const useRuleSamples = (
  provider: SampleProvider | undefined,
): readonly RecordDoc[] => {
  const samples = useContext(RuleSamplesContext);
  return provider ? (samples[provider] ?? []) : [];
};

const isObject = (v: JSONValue | undefined): v is Record<string, JSONValue> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Paths a field picker offers for `records`: each record key, each item
 * key under `$.items[*]`, and `_raw` leaves (two levels deep). For
 * `scope` item, the item keys as `$.key`. */
export function samplePaths(
  records: readonly RecordDoc[],
  scope: 'record' | 'item' = 'record',
): string[] {
  const paths = new Set<string>();
  const name = (k: string) =>
    /^[A-Za-z_][\w]*$/.test(k) ? `.${k}` : `['${k}']`;
  for (const record of records) {
    const items = Array.isArray(record.items) ? record.items : [];
    for (const item of items)
      if (isObject(item))
        for (const k of Object.keys(item))
          paths.add(scope === 'item' ? `$${name(k)}` : `$.items[*]${name(k)}`);
    if (scope === 'item') continue;
    for (const [k, v] of Object.entries(record)) {
      if (k === 'items') continue;
      if (k === '_raw' && isObject(v)) {
        for (const [k2, v2] of Object.entries(v)) {
          if (isObject(v2))
            for (const k3 of Object.keys(v2))
              paths.add(`$._raw${name(k2)}${name(k3)}`);
          else paths.add(`$._raw${name(k2)}`);
        }
      } else paths.add(`$${name(k)}`);
    }
  }
  return [...paths].sort();
}

/** The raw data behind `records` (each record's `_raw`), and the raw
 * items `itemsPath` finds in it: what a source rule's translation rules
 * test. */
export function rawSamples(
  records: readonly RecordDoc[],
  itemsPath?: string,
): { records: JSONValue[]; items: JSONValue[] } {
  const raws = records.flatMap((r) => (r._raw === undefined ? [] : [r._raw]));
  const path = itemsPath === undefined ? undefined : compilePath(itemsPath);
  return {
    records: raws,
    items: path?.ok ? raws.flatMap((raw) => valuesAt(path.query, raw)) : [],
  };
}

const SAMPLE_LIMIT = 50;

/** The board's cell records per source, up to `SAMPLE_LIMIT` each,
 * Unknown cells' records first (the field picker shows the first). */
export function ruleSamples(
  rows: readonly { id: string; type: SampleProvider }[],
  cells: Readonly<
    Partial<
      Record<
        string,
        {
          rowId: string;
          derivation: {
            kind: string;
            document?: RecordDoc;
            status?: { id: string };
          };
        }
      >
    >
  >,
): RuleSamples {
  const typeOf = new Map(rows.map((r) => [r.id, r.type]));
  const out: Record<SampleProvider, RecordDoc[]> = { github: [], amplify: [] };
  const known = Object.values(cells).filter(
    (c) => c?.derivation.kind === 'ok' && c.derivation.document,
  );
  const unknownFirst = [
    ...known.filter((c) => c?.derivation.status?.id === UNKNOWN_STATUS_ID),
    ...known.filter((c) => c?.derivation.status?.id !== UNKNOWN_STATUS_ID),
  ];
  for (const cell of unknownFirst) {
    const type = cell ? typeOf.get(cell.rowId) : undefined;
    const doc = cell?.derivation.document;
    if (type && doc && out[type].length < SAMPLE_LIMIT) out[type].push(doc);
  }
  return out;
}
