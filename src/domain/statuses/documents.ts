/**
 * The records status rules see (spec.md A§4.3.7), built from raw provider
 * data by the built-in source rules: a GitHub run with its latest
 * attempt's jobs (those the row's keys take) as items, an Amplify job with
 * its console link. A GitHub record keeps only the items its set's item
 * rule counts, and is `undefined` when none count (not the cell's).
 *
 * @module
 */
import type { MatchTest } from '@/domain/config/matchTest';
import { latestAttemptJobs } from '@/domain/derivation/latestAttempt';
import type {
  AmplifyJobWithBranch,
  GithubRunWithJobs,
} from '@/domain/derivation/types';
import { matchesAny } from '@/domain/matching/matchTest';
import { BUILTIN_SOURCES } from '@/domain/model/builtinSources';
import { asJson } from '@/domain/model/json';
import { itemsOf, type RecordDoc, translate } from '@/domain/model/translate';
import { evaluateRule } from '@/domain/rules/check';
import type { Rule } from '@/domain/rules/schema';
import { buildAmplifyConsoleLink } from '@/lib/amplify/consoleLink';

const source = (id: string) => {
  const rule = BUILTIN_SOURCES.find((s) => s.id === id);
  if (!rule) throw new Error(`no source rule ${id}`);
  return rule;
};

/** A run's record for a row (its keys) and set (its item rule), or
 * `undefined` when no item counts. */
export function githubRecord(
  entry: GithubRunWithJobs,
  rowKeyTests: readonly MatchTest[],
  items: Rule,
): RecordDoc | undefined {
  const jobs = latestAttemptJobs(entry.jobs).filter(
    (job) =>
      rowKeyTests.length === 0 ||
      matchesAny(
        rowKeyTests,
        { jobName: job.name, workflowName: entry.run.workflowName },
        false,
      ),
  );
  const { record } = translate(
    source('github'),
    asJson({ run: entry.run, jobs }),
  );
  const counted = itemsOf(record).filter((i) => evaluateRule(items, i));
  return counted.length > 0 ? { ...record, items: counted } : undefined;
}

/** An Amplify job's record. */
export function amplifyRecord({
  source: app,
  branch,
  job,
}: AmplifyJobWithBranch): RecordDoc {
  const consoleUrl =
    job.jobId === undefined
      ? null
      : buildAmplifyConsoleLink({ ...app, branch, jobId: job.jobId });
  return translate(
    source('amplify'),
    asJson({ source: app, branch, job, consoleUrl }),
  ).record;
}
