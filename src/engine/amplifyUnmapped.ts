/**
 * Unmapped Amplify jobs (spec.md A§4.3.7, C-15, §3.12): a job kept by
 * *keep* that lands in no cell reading its app, with the reason of each
 * row reading it: a job is unmapped for a row when no cell of the row
 * that reads that app places it. Amplify records have no items, so every
 * reason can be judged. Pure.
 *
 * @module
 */
import { PROVIDER_LABELS } from '@/domain/config/providers';
import type { AmplifyRow } from '@/domain/config/row';
import { rowReasons } from '@/domain/derivation';
import type { CellRules } from '@/domain/model/cell';
import { isJsonObject, textOf } from '@/domain/model/json';
import type { RecordDoc } from '@/domain/model/translate';

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

/** The rows reading app `key` (`appKey`), each with the columns that
 * read it, and the app's kept `records`: those no reader places. */
export function amplifyUnmapped(
  readers: readonly { row: AmplifyRow; stageIds: readonly string[] }[],
  rulesFor: (row: AmplifyRow, stageId: string) => CellRules,
  key: string,
  records: readonly RecordDoc[],
): UnmappedRun[] {
  const rows = readers.map(({ row, stageIds }) => ({
    rowId: row.id,
    cells: stageIds.map((s) => rulesFor(row, s)),
  }));
  return records.flatMap((record) => {
    const reasons = rowReasons(record, rows, true);
    if (!reasons) return [];
    const [first] = reasons;
    const job = rawJob(record);
    // Shown: the branch as translated. Identity: the branch Amplify
    // read (job ids count per branch, and a source rule may translate
    // two branches to one value).
    const branch = textOf(record.branch) ?? job.branch ?? null;
    const readBranch = job.branch ?? branch ?? '';
    const run: UnmappedRun = {
      provider: 'amplify',
      id: `amplify:${key}:${readBranch}#${job.jobId ?? ''}`,
      where: job.appId ?? PROVIDER_LABELS.amplify,
      title: `Amplify job ${job.jobId ?? '?'}`,
      branch,
      htmlUrl: textOf(record.link) ?? '',
      record,
      reason: first.reason,
      rows: reasons,
    };
    return [run];
  });
}
