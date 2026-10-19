/**
 * Amplify records (spec.md A§4.3.7): an Amplify job, with its console
 * link, translated by the Amplify source rule.
 *
 * @module
 */
import type { AmplifyJobWithBranch } from '@/domain/derivation/types';
import { BUILTIN_SOURCES } from '@/domain/model/builtinSources';
import { asJson } from '@/domain/model/json';
import type { SourceRule } from '@/domain/model/sourceRule';
import { type RecordDoc, translate } from '@/domain/model/translate';
import { buildAmplifyConsoleLink } from '@/lib/amplify/consoleLink';

const builtin = (id: string): SourceRule => {
  const rule = BUILTIN_SOURCES.find((s) => s.id === id);
  if (!rule) throw new Error(`no source rule ${id}`);
  return rule;
};

/** An Amplify job's record under `rule` (the built-in by default). */
export function amplifyRecord(
  { source: app, branch, job }: AmplifyJobWithBranch,
  rule: SourceRule = builtin('amplify'),
): RecordDoc {
  const consoleUrl =
    job.jobId === undefined
      ? null
      : buildAmplifyConsoleLink({ ...app, branch, jobId: job.jobId });
  return translate(rule, asJson({ source: app, branch, job, consoleUrl }))
    .record;
}
