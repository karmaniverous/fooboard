/**
 * One Amplify app read from the cache (spec.md §3.1, §2.3): its branch
 * list (a root query), then a jobs query for each branch the branch rule
 * chooses, the jobs translated into records once per landing and kept by
 * the source's `keep` rule. A failed read of the app affects only the
 * rows reading it. Pure.
 *
 * @module
 */
import type { JobSummary } from '@aws-sdk/client-amplify';
import type { QueryClient } from '@tanstack/query-core';
import type { JSONValue } from 'json-p3';

import { asJson } from '@/domain/model/json';
import type { SourceRuleOf } from '@/domain/model/sourceRule';
import type { KeyProblem, RecordDoc } from '@/domain/model/translate';
import { evaluateRule } from '@/domain/rules/check';
import { amplifyTranslate } from '@/domain/statuses/documents';
import {
  chosenBranches,
  type ResolvedAmplifySource,
} from '@/lib/amplify/rowJobs';
import { amplifySnapshot } from '@/query/cache';
import type { AmplifyRequest } from '@/query/keys';

import { type FailureOutcome, failureOutcome } from './providerOutcome';
import type { ReadBranch } from './windowHints';

type AmplifySource = SourceRuleOf<'amplify'>;

/** What the cache holds for one app. */
export interface AppState {
  /** The credential the app is read with. */
  credentialId: string;
  requests: AmplifyRequest[];
  failure?: FailureOutcome;
  /** The kept records of every branch whose jobs landed. */
  records: RecordDoc[];
  keyProblems: KeyProblem[];
  /** The branch list's entries, for the branch rule's sample. */
  branches: JSONValue[];
  /** Some branch's read came back full (window hints for cells whose
   * stage rule isn't a branch pattern): the OR of `readBranches`. */
  full: boolean;
  /** Each branch whose jobs landed, and whether its own read came back
   * full (window hints for branch-pattern cells, Decision 94). */
  readBranches: ReadBranch[];
  /** The branch list and every chosen branch's jobs have landed. */
  complete: boolean;
  /** When the branch list last landed (ms; 0 when never). */
  updatedAt: number;
}

interface Translated {
  records: RecordDoc[];
  keyProblems: KeyProblem[];
}

const memo = new WeakMap<
  readonly JobSummary[],
  { source: AmplifySource; out: Translated }
>();

/** One branch's jobs as kept records, memoized per landing. */
function translated(
  app: ResolvedAmplifySource,
  branch: string,
  jobs: readonly JobSummary[],
  source: AmplifySource,
): Translated {
  const hit = memo.get(jobs);
  if (hit?.source === source) return hit.out;
  const tag = { region: app.region, appId: app.appId };
  const all = jobs.map((job) =>
    amplifyTranslate({ source: tag, branch, job }, source),
  );
  const out = {
    records: all
      .map((t) => t.record)
      .filter((r) => evaluateRule(source.keep, r)),
    keyProblems: all.flatMap((t) => t.problems),
  };
  memo.set(jobs, { source, out });
  return out;
}

/** The state of app `app` in the cache. */
export function appState(
  client: QueryClient,
  app: ResolvedAmplifySource,
  source: AmplifySource,
): AppState {
  const { credentialId, region, appId } = app;
  const branchesRequest = { call: 'branches', region, appId } as const;
  const list = amplifySnapshot(client, credentialId, branchesRequest);
  const state: AppState = {
    credentialId,
    requests: [branchesRequest],
    records: [],
    keyProblems: [],
    branches: [],
    full: false,
    readBranches: [],
    complete: false,
    updatedAt: list.updatedAt,
  };
  const listFailure = failureOutcome(list.failed, list.error);
  if (listFailure) return { ...state, failure: listFailure };
  if (!list.data) return state;
  state.branches = list.data.data.map((b) => asJson(b));
  const max = source.reader.jobsPerBranch;
  let complete = true;
  for (const branch of chosenBranches(list.data.data, source.reader)) {
    const request = { call: 'jobs', region, appId, branch, max } as const;
    state.requests.push(request);
    const jobs = amplifySnapshot(client, credentialId, request);
    const failure = failureOutcome(jobs.failed, jobs.error);
    if (failure) return { ...state, failure };
    if (!jobs.data) {
      complete = false;
      continue;
    }
    const found = translated(app, branch, jobs.data.data, source);
    state.records.push(...found.records);
    state.keyProblems.push(...found.keyProblems);
    const full = jobs.data.data.length >= max;
    state.readBranches.push({ name: branch, full });
    state.full ||= full;
  }
  return { ...state, complete };
}
