/**
 * Where the editor opens for a fix (spec.md C-15, A§4.3.7): *Add rule*
 * and *Add override* from an unmapped record, and *Fix* from a problem.
 * *Add rule* opens the rule to change with a check drafted from the
 * record: for a branch no stage rule matches, a new stage for that branch
 * (or, with *Add override*, a stage-rule override on a row reading the
 * record's repo or app, or its group); for no row rule, the row's record
 * rule; for no item counting, the item rule of the status set the row
 * uses; for an empty order key, the source rule's order key. Pure.
 *
 * @module
 */

import type { Dashboard } from '@/domain/config/dashboard';
import { UNMAPPED } from '@/domain/derivation';
import { textOf } from '@/domain/model/json';
import { keyPath, RECORD_KEYS, RESERVED_KEYS } from '@/domain/model/keys';
import { is } from '@/domain/model/ruleBuilders';
import { sourceRuleFor } from '@/domain/model/sources';
import { itemsOf, type RecordDoc } from '@/domain/model/translate';
import { type Problem, targetOf } from '@/domain/problems/problem';
import { escapeGlob } from '@/domain/rules/glob';
import { PATH_IDENTIFIER } from '@/domain/rules/path';
import type { Check } from '@/domain/rules/schema';
import { statusSetFor } from '@/domain/statuses/resolve';
import type { UnmappedRun } from '@/engine';

import {
  type EditorTab,
  focusKeys,
  NEW_STAGE_KEY,
  statusSetItemsKey,
  tabFor,
} from './editTarget';

export interface EditorDraft {
  tab: EditorTab;
  /** Editor items to open and scroll to, most specific first. */
  focus?: readonly string[];
  /** Rows: offer `branch` as a stage-rule override on these rows (and
   * their groups). */
  override?: { branch: string; rowIds: readonly string[] };
  /** Stages: a new stage for this branch. */
  pattern?: string;
  /** A check drafted from a record, offered on the focused rule. */
  check?: Check;
}

/** Keys the board shows rather than tests by (a poor first check). */
const SHOWN = new Set<string>([
  RESERVED_KEYS.time,
  RESERVED_KEYS.link,
  RESERVED_KEYS.message,
  RESERVED_KEYS.commit,
  RECORD_KEYS.items,
  RECORD_KEYS.raw,
]);

/** A first check matching `doc`: its first key with a text value that
 * isn't one the board only shows (nor `skip`). */
function draftCheck(doc: RecordDoc, skip?: string): Check | undefined {
  const hit = Object.entries(doc).find(
    (e): e is [string, string] =>
      !SHOWN.has(e[0]) &&
      e[0] !== skip &&
      typeof e[1] === 'string' &&
      e[1] !== '' &&
      PATH_IDENTIFIER.test(e[0]),
  );
  return hit ? is(keyPath(hit[0]), escapeGlob(hit[1])) : undefined;
}

/** The rows of the dashboard that `run` names for `kind`. */
const rowsFor = (
  run: UnmappedRun,
  dashboard: Pick<Dashboard, 'rows'>,
  kind?: UnmappedRun['reason']['kind'],
) =>
  dashboard.rows.filter((r) =>
    run.rows.some(
      (x) => x.rowId === r.id && (kind === undefined || x.reason.kind === kind),
    ),
  );

export function draftFor(
  run: UnmappedRun,
  dashboard: Dashboard,
): EditorDraft | undefined {
  const { reason, record } = run;
  switch (reason.kind) {
    case UNMAPPED.noStageMatches: {
      const branch = reason.branch ?? textOf(record.branch);
      return branch === undefined
        ? undefined
        : { tab: 'Stages', pattern: branch, focus: [NEW_STAGE_KEY] };
    }
    case UNMAPPED.noRowMatches: {
      const row = rowsFor(run, dashboard, UNMAPPED.noRowMatches).at(0);
      if (!row) return undefined;
      const order = sourceRuleFor(dashboard, row.type).order;
      return {
        tab: 'Rows',
        focus: focusKeys({ kind: 'row', id: row.id, part: 'record' }),
        check: draftCheck(record, order),
      };
    }
    case UNMAPPED.noItemCounts: {
      const row = rowsFor(run, dashboard, UNMAPPED.noItemCounts).at(0);
      if (!row) return { tab: 'Statuses' };
      // The row's set in its first column: an unmapped run is in none.
      const set = statusSetFor(
        dashboard,
        row,
        dashboard.stages.at(0)?.id ?? '',
      );
      const item = itemsOf(record).at(0);
      return {
        tab: 'Statuses',
        focus: [
          statusSetItemsKey(set.id),
          ...focusKeys({ kind: 'statusSet', id: set.id }),
        ],
        check: item ? draftCheck(item) : undefined,
      };
    }
    case UNMAPPED.noOrderKey: {
      const order = sourceRuleFor(dashboard, run.provider).order;
      return {
        tab: 'Sources',
        focus: focusKeys({
          kind: 'source',
          provider: run.provider,
          key: order,
        }),
      };
    }
  }
}

/** The second fix for a branch no stage rule matches: a stage-rule
 * override on a row reading the record's repo or app (or its group).
 * Undefined for other reasons or when no row on the board reads it. */
export function overrideDraftFor(
  run: UnmappedRun,
  dashboard: Pick<Dashboard, 'rows'>,
): EditorDraft | undefined {
  if (run.reason.kind !== UNMAPPED.noStageMatches) return undefined;
  const branch = run.reason.branch ?? textOf(run.record.branch);
  const rows = rowsFor(run, dashboard);
  const first = rows.at(0);
  if (branch === undefined || !first) return undefined;
  return {
    tab: 'Rows',
    focus: [`row:${first.id}:override`, `row:${first.id}`],
    override: { branch, rowIds: rows.map((r) => r.id) },
  };
}

/** The editor opened at the item that fixes `problem`. */
export function problemDraft(problem: Problem): EditorDraft {
  const target = targetOf(problem);
  return { tab: tabFor(target), focus: focusKeys(target) };
}
