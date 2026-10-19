/**
 * Unmapped Amplify jobs (spec.md A§4.3.7, C-15): a job kept by *keep*
 * that lands in no cell of any row reading its app, with each such row's
 * reason. Amplify records have no items, so every reason can be judged.
 * Pure.
 *
 * @module
 */
import type { AmplifyRow } from '@/domain/config/row';
import { unmappedReason } from '@/domain/derivation';
import type { RecordDoc } from '@/domain/model/translate';
import { appKey, type ResolvedAmplifySource } from '@/lib/amplify/rowJobs';

import type { AmplifyRowsInput } from './amplifyRow';
import type { UnmappedRun } from './types';

const text = (v: unknown): string | undefined =>
  typeof v === 'string' && v !== '' ? v : undefined;

/** Job id, app and branch of an Amplify record, from its raw data. */
function rawJob(record: RecordDoc): {
  jobId?: string;
  appId?: string;
  branch?: string;
} {
  const raw = record._raw;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
  const job = raw.job;
  const app = raw.source;
  return {
    jobId:
      typeof job === 'object' && job !== null && !Array.isArray(job)
        ? text(job.jobId)
        : undefined,
    appId:
      typeof app === 'object' && app !== null && !Array.isArray(app)
        ? text(app.appId)
        : undefined,
    branch: text(raw.branch),
  };
}

export function amplifyUnmapped(
  input: Pick<AmplifyRowsInput, 'rows' | 'stages' | 'rulesFor'>,
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
    const cells = new Map(readers.map((r) => [r.id, cellsOf(r)]));
    for (const record of records) {
      const rows = readers.map((r) => ({
        rowId: r.id,
        reason: unmappedReason(record, cells.get(r.id) ?? [], true),
      }));
      const reasons = rows.flatMap(({ rowId, reason }) =>
        reason ? [{ rowId, reason }] : [],
      );
      if (reasons.length === 0 || reasons.length < rows.length) continue;
      const [first] = reasons;
      const job = rawJob(record);
      const branch = text(record.branch) ?? job.branch ?? null;
      out.push({
        provider: 'amplify',
        id: `amplify:${key}:${branch ?? ''}#${job.jobId ?? ''}`,
        where: job.appId ?? 'Amplify',
        title: `Amplify job ${job.jobId ?? '?'}`,
        branch,
        htmlUrl: text(record.link) ?? '',
        record,
        reason: first.reason,
        rows: reasons,
      });
    }
  }
  return out;
}
