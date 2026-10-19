/**
 * Amplify records (spec.md A§4.3.7): an Amplify job, with its console
 * link, translated by the built-in Amplify source rule.
 *
 * @module
 */
import type { AmplifyJobWithBranch } from '@/domain/derivation/types';
import { BUILTIN_SOURCES } from '@/domain/model/builtinSources';
import { asJson } from '@/domain/model/json';
import { type RecordDoc, translate } from '@/domain/model/translate';
import { buildAmplifyConsoleLink } from '@/lib/amplify/consoleLink';

const source = (id: string) => {
  const rule = BUILTIN_SOURCES.find((s) => s.id === id);
  if (!rule) throw new Error(`no source rule ${id}`);
  return rule;
};

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
