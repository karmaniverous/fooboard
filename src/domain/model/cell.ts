/**
 * Which record a cell shows, and its status (spec.md A§4.3.7), in order:
 * the record and stage rules test each full record; items count when they
 * pass the row's and the set's item rules (a record with items but none
 * counted is dropped); the last remaining record by the order key wins;
 * its status is the first cell status whose rule matches it with only its
 * counted items, else Unknown. Time and link come from the counted item
 * with the latest `time`, else the record. Pure.
 *
 * @module
 */
import type { JSONValue } from 'json-p3';

import type { CellStatus, StatusSet } from '@/domain/config/statusSets';
import { evaluateRule } from '@/domain/rules/check';
import type { Rule } from '@/domain/rules/schema';

import { RECORD_KEYS } from './keys';
import {
  compareOrder,
  hasItems,
  itemsOf,
  orderOf,
  type RecordDoc,
} from './translate';

/** A path naming items, raw data or a descendant segment, so it can't be
 * judged before items are read. */
const NEEDS_ITEMS = new RegExp(
  `${RECORD_KEYS.items}|${RECORD_KEYS.raw}|\\.\\.`,
);

export interface CellRules {
  record: Rule;
  /** The row's item rule. */
  items: Rule;
  /** `undefined`: no level set one, so nothing matches. */
  stage: Rule | undefined;
  set: StatusSet;
  order: string;
}

export interface PlacedRecord {
  /** The record with only its counted items. */
  record: RecordDoc;
  /** The matched cell status; `undefined` is Unknown. */
  status: CellStatus | undefined;
  time: JSONValue;
  link: JSONValue;
}

/** `record` with only the items both item rules count, or `undefined`
 * when it has items and none count. */
export function counted(
  record: RecordDoc,
  rowItems: Rule,
  setItems: Rule,
): RecordDoc | undefined {
  if (!hasItems(record)) return record;
  const items = itemsOf(record).filter(
    (i) => evaluateRule(rowItems, i) && evaluateRule(setItems, i),
  );
  return items.length > 0 ? { ...record, items } : undefined;
}

/** Does `record` belong in the cell, before items are counted? */
export const placed = (record: RecordDoc, rules: CellRules): boolean =>
  rules.stage !== undefined &&
  evaluateRule(rules.record, record) &&
  evaluateRule(rules.stage, record);

/** Do the cell's record or stage rules test items (or raw data), so a
 * record can't be judged before its items are read? */
export const needsItems = (
  rules: Pick<CellRules, 'record' | 'stage'>,
): boolean => [rules.record, rules.stage].some(ruleNeedsItems);

/** Does `rule` test items (or raw data)? */
export const ruleNeedsItems = (rule: Rule | undefined): boolean =>
  (rule?.checks ?? []).some((c) => NEEDS_ITEMS.test(c.path));

/** The first cell status whose rule matches `record`. */
const classify = (
  record: RecordDoc,
  set: Pick<StatusSet, 'cell'>,
): CellStatus | undefined => set.cell.find((c) => evaluateRule(c.rule, record));

/** Time and link: the counted item with the latest `time`, else the
 * record's own. */
function timeAndLink(record: RecordDoc): {
  time: JSONValue;
  link: JSONValue;
} {
  const latest = itemsOf(record)
    .filter((i) => (i.time ?? null) !== null && i.time !== '')
    .reduce<RecordDoc | undefined>(
      (best, i) =>
        best === undefined ||
        compareOrder(i.time ?? null, best.time ?? null) > 0
          ? i
          : best,
      undefined,
    );
  return latest
    ? { time: latest.time ?? null, link: latest.link ?? record.link ?? null }
    : { time: record.time ?? null, link: record.link ?? null };
}

/** The record `records` puts in the cell, or `undefined` for none. */
export function placeCell(
  records: readonly RecordDoc[],
  rules: CellRules,
): PlacedRecord | undefined {
  let best: RecordDoc | undefined;
  for (const record of records) {
    if (orderOf(record, rules.order) === null) continue;
    if (!placed(record, rules)) continue;
    const kept = counted(record, rules.items, rules.set.items);
    if (!kept) continue;
    if (
      !best ||
      compareOrder(orderOf(kept, rules.order), orderOf(best, rules.order)) > 0
    )
      best = kept;
  }
  if (!best) return undefined;
  return {
    record: best,
    status: classify(best, rules.set),
    ...timeAndLink(best),
  };
}
