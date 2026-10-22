/**
 * Unmapped Amplify jobs (spec.md A§4.3.7, C-15): a job kept by *keep*
 * that lands in no cell of any row reading its app, with each such row's
 * reason. Amplify records have no items, so every reason can be judged.
 * Pure.
 *
 * @module
 */
import { PROVIDER_LABELS } from '@/domain/config/providers';
import type { AmplifyRow } from '@/domain/config/row';
import { rowReasons } from '@/domain/derivation';
import type { CellRules } from '@/domain/model/cell';
import { isJsonObject, textOf } from '@/domain/model/json';
import type { RecordDoc } from '@/domain/model/translate';
import { appKey, type ResolvedAmplifySource } from '@/lib/amplify/rowJobs';

import type { UnmappedRun } from './types';

/** Job id, app and branch of an Amplify record, from its raw data. */
function rawJob(record: RecordDoc): {
  jobId?: string;
  appId?: string;
  branch?: string;
} {
  const raw = record._raw;
  if (!isJsonObject(raw)) return {};
  const { job, source: app } = raw;
  return {
    jobId: isJsonObject(job) ? textOf(job.jobId) : undefined,
    appId: isJsonObject(app) ? textOf(app.appId) : undefined,
    branch: textOf(raw.branch),
  };
}

export function amplifyUnmapped(
  input: {
    rows: readonly AmplifyRow[];
    stages: readonly { id: string }[];
    rulesFor: (row: AmplifyRow, stageId: string) => CellRules;
  },
  reading: ReadonlyMap<string, readonly ResolvedAmplifySource[]>,
  apps: ReadonlyMap<string, { records: readonly RecordDoc[] }>,
): UnmappedRun[] {
  const cellsOf = (row: AmplifyRow) =>
    input.stages.map((s) => input.rulesFor(row, s.id));
  const out: UnmappedRun[] = [];
  for (const [key, { records }] of apps) {
    const readers = input.rows.filter((r) =>
      (reading.get(r.id) ?? []).some((s) => appKey(s) === key),
    );
    const rows = readers.map((r) => ({ rowId: r.id, cells: cellsOf(r) }));
    for (const record of records) {
      const reasons = rowReasons(record, rows, true);
      if (!reasons) continue;
      const [first] = reasons;
      const job = rawJob(record);
      // Shown: the branch as translated. Identity: the branch Amplify
      // read (job ids count per branch, and a source rule may translate
      // two branches to one value).
      const branch = textOf(record.branch) ?? job.branch ?? null;
      const readBranch = job.branch ?? branch ?? '';
      out.push({
        provider: 'amplify',
        id: `amplify:${key}:${readBranch}#${job.jobId ?? ''}`,
        where: job.appId ?? PROVIDER_LABELS.amplify,
        title: `Amplify job ${job.jobId ?? '?'}`,
        branch,
        htmlUrl: textOf(record.link) ?? '',
        record,
        reason: first.reason,
        rows: reasons,
      });
    }
  }
  return out;
}
