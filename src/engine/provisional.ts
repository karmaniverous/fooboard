/**
 * Provisional status (spec.md §3.1, Decision 37): until a cell's jobs
 * land, a cell whose rules don't test items shows its run's own state,
 * mapped to the preset summary statuses: queued or in progress (waiting,
 * requested and pending count as queued) is *Running*; a failure or time
 * out is *Failing*; cancelled is *Cancelled*; success is *OK*. The cell's
 * set supplies the look of the summary status of that name; a set with
 * none of that name gets a neutral mark. Anything else (skipped, neutral,
 * stale, action required) shows nothing until the jobs land.
 *
 * @module
 */
import type { StatusSet, SummaryStatus } from '@/domain/config/statusSets';
import type { CellResult } from '@/domain/derivation';
import { textOf } from '@/domain/model/json';
import type { RecordDoc } from '@/domain/model/translate';
import {
  PRESET_SUMMARY,
  PRESET_SUMMARY_IDS as S,
} from '@/domain/statuses/presetRules';
import type { ResolvedStatus } from '@/domain/statuses/resolved';
import type { WorkflowRun } from '@/lib/github';

import type { ProvisionalLook } from './types';

/** Run statuses that count as queued or running. */
const RUNNING_STATUSES = new Set([
  'queued',
  'in_progress',
  'waiting',
  'requested',
  'pending',
]);

/** Completed runs' conclusions, by the preset summary they map to. */
const CONCLUSIONS: Partial<Record<string, string>> = {
  failure: S.failing,
  timed_out: S.failing,
  cancelled: S.cancelled,
  success: S.ok,
};

/** The id of the provisional status (never a real status's id). */
export const PROVISIONAL_STATUS_ID = 'provisional';

/** The preset summary status a run's own state maps to, if any. */
function runSummary(
  run: Pick<WorkflowRun, 'status' | 'conclusion'>,
): SummaryStatus | undefined {
  const id = RUNNING_STATUSES.has(run.status ?? '')
    ? S.running
    : CONCLUSIONS[run.conclusion ?? ''];
  return PRESET_SUMMARY.find((summary) => summary.id === id);
}

const sameName = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: 'accent' }) === 0;

/** The provisional cell for a run's record, or `undefined` when its
 * state maps to no preset summary status. */
export function provisionalCell(
  set: Pick<StatusSet, 'summary'>,
  run: Pick<WorkflowRun, 'status' | 'conclusion'>,
  record: RecordDoc,
): { result: CellResult; look: ProvisionalLook } | undefined {
  const preset = runSummary(run);
  if (!preset) return undefined;
  const matched = set.summary.find((s) => sameName(s.name, preset.name));
  const summary = matched ?? preset;
  const status: ResolvedStatus = {
    id: PROVISIONAL_STATUS_ID,
    name: summary.name,
    color: summary.color,
    icon: summary.icon,
    outlined: false,
    // Running counts as in progress whatever the set says (§3.1).
    summary: { ...summary, inProgress: preset.inProgress },
    rank: matched ? set.summary.indexOf(matched) : set.summary.length,
  };
  return {
    look: matched ? 'status' : 'neutral',
    result: {
      kind: 'ok',
      status,
      branch: textOf(record.branch),
      commit: textOf(record.commit),
      message: textOf(record.message),
      time: textOf(record.time),
      linkUrl: textOf(record.link),
      document: record,
    },
  };
}
