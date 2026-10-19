/**
 * Unmapped records (spec.md C-15, A§4.3.7): why a kept record lands in no
 * cell of any row reading its repo or app. Records dropped by *keep* were
 * filtered on purpose and are never unmapped. Pure.
 *
 * @module
 */
import type { JSONValue } from 'json-p3';

import { type CellRules, counted } from '@/domain/model/cell';
import type { RecordDoc } from '@/domain/model/translate';
import { evaluateRule } from '@/domain/rules/check';

export type UnmappedReason =
  | { kind: 'no-stage-matches'; branch?: string }
  | { kind: 'no-row-matches' }
  | { kind: 'no-item-counts' }
  | { kind: 'no-order-key' };

/** Text for the Unmapped panel. */
export function describeUnmappedReason(reason: UnmappedReason): string {
  switch (reason.kind) {
    case 'no-stage-matches':
      return reason.branch === undefined
        ? 'no stage rule matches'
        : `no stage rule matches branch "${reason.branch}"`;
    case 'no-row-matches':
      return 'no row rule matches';
    case 'no-item-counts':
      return 'no item counts';
    case 'no-order-key':
      return 'no order key';
  }
}

const text = (v: JSONValue | undefined): string | undefined =>
  typeof v === 'string' && v !== '' ? v : undefined;

/** Why `record` lands in none of `cells`, or `undefined` when it lands in
 * one. Without its items read (`itemsKnown` false) only the stage and
 * row rules can say. */
export function unmappedReason(
  record: RecordDoc,
  cells: readonly CellRules[],
  itemsKnown: boolean,
): UnmappedReason | undefined {
  if (cells.some((c) => (record[c.order] ?? null) === null))
    return { kind: 'no-order-key' };
  const staged = cells.filter(
    (c) => c.stage !== undefined && evaluateRule(c.stage, record),
  );
  if (staged.length === 0)
    return { kind: 'no-stage-matches', branch: text(record.branch) };
  const rowed = staged.filter((c) => evaluateRule(c.record, record));
  if (rowed.length === 0) return { kind: 'no-row-matches' };
  if (!itemsKnown) return undefined;
  return rowed.some((c) => counted(record, c.items, c.set.items))
    ? undefined
    : { kind: 'no-item-counts' };
}
