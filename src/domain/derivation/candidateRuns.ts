/**
 * Candidate run selection for a GitHub cell (spec.md §4.3.2): runs
 * triggered by `pull_request`/`pull_request_target` are excluded, then the
 * workflow filter and the stage's branch pattern narrow the rest. The
 * 100-run window itself is a provider fetch parameter (`per_page=100`,
 * built in PR B), not a derivation concern. Pure; no network.
 *
 * @module
 */
import type { MappingSettings } from '@/domain/config/mappingSettings';
import { matchesBranchPattern } from '@/domain/matching/branchPattern';
import { matchesAny } from '@/domain/matching/matchTest';

import type { GithubRunWithJobs } from './types';

const EXCLUDED_EVENTS = new Set(['pull_request', 'pull_request_target']);

/** Is this a pull-request run, which fooboard never maps (spec.md §4.3.2)? */
export function isExcludedEvent(event: string): boolean {
  return EXCLUDED_EVENTS.has(event);
}

/** Does this run pass the workflow filter (spec.md §4.3.1: empty `include`
 * means include all; empty `exclude` excludes nothing)? */
export function passesWorkflowFilter(
  workflowName: string,
  mapping: MappingSettings,
): boolean {
  const context = { jobName: '', workflowName };
  const included = matchesAny(mapping.workflowFilter.include, context, true);
  const excluded = matchesAny(mapping.workflowFilter.exclude, context, false);
  return included && !excluded;
}

/** Is this run a candidate for `branchPattern` (spec.md §4.3.2 step 1)? */
export function isCandidateRun(
  { run }: GithubRunWithJobs,
  mapping: MappingSettings,
  branchPattern: string,
): boolean {
  if (isExcludedEvent(run.event)) return false;
  if (!passesWorkflowFilter(run.workflowName, mapping)) return false;
  return (
    run.headBranch !== null &&
    matchesBranchPattern(branchPattern, run.headBranch)
  );
}

/** Candidate runs for a stage, newest first by `createdAt`. */
export function selectCandidateRuns(
  runs: readonly GithubRunWithJobs[],
  mapping: MappingSettings,
  branchPattern: string,
): GithubRunWithJobs[] {
  return runs
    .filter((entry) => isCandidateRun(entry, mapping, branchPattern))
    .slice()
    .sort(
      (a: GithubRunWithJobs, b: GithubRunWithJobs) =>
        new Date(b.run.createdAt).getTime() -
        new Date(a.run.createdAt).getTime(),
    );
}
