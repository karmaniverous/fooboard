/**
 * One GitHub row derived from the cache (spec.md §3.1, §2.3): its repo's
 * runs pages (page 1, then each next page while the window needs it),
 * then per cell a walk over the candidates newest first. A run that
 * passes the cell's record and stage rules needs its jobs: the walk asks
 * for the jobs of up to `COLD_CANDIDATES_PER_STAGE` runs it can't judge
 * yet, and goes on past them only to find a cached placement. Until the
 * jobs land, a cell whose rules don't test items shows its run's state
 * provisionally (Decision 37), or its cached placement marked refreshing.
 * The whole row is refreshing while its runs have been fetching longer
 * than the refreshing delay or are older than their poll interval
 * (Decisions 46, 47). Pure: reads the cache, never fetches.
 *
 * @module
 */
import type { QueryClient } from '@tanstack/query-core';

import type { GithubRow } from '@/domain/config/row';
import type { Stage } from '@/domain/config/stage';
import { deriveCell } from '@/domain/derivation';
import {
  type CellRules,
  needsItems,
  placeCell,
  placed,
  type PlacedRecord,
} from '@/domain/model/cell';
import type { SourceRuleOf } from '@/domain/model/sourceRule';
import type { Problem } from '@/domain/problems/problem';
import { evaluateRule } from '@/domain/rules/check';
import { type Fetched, pagesFor, type WorkflowRun } from '@/lib/github';
import { githubSnapshot, type Snapshot } from '@/query/cache';
import {
  ACTIVE_INTERVAL_MS,
  boostedRootFreshness,
  pollEvery,
  rootFreshness,
  SETTLED,
} from '@/query/intervals';
import { githubKey, type GithubRequest } from '@/query/keys';

import { finalView } from './cells';
import { type Candidate, githubCandidates } from './githubCandidates';
import { jobsOf } from './githubJobs';
import type { Need, RowDerivation } from './need';
import {
  failedDerivation,
  failedView,
  failureOutcome,
  failureProblem,
  rowProblem,
} from './providerOutcome';
import { provisionalCell } from './provisional';
import { isRefreshing, markRefreshing, type RefreshClock } from './refreshing';
import type { CellView } from './types';

/** Runs per cell whose jobs load at once on a cold cache (Decision 29
 * item 8), set from measurement on a 16-repo board at 10 requests in
 * flight: 1 filled it in 27 s with 228 requests, 2 in 37 s (327), 3 in
 * 47 s (411). Confirmed by Decision 45 item 2 and rechecked in N8.
 * The stages of a row share candidates, so reading ahead mostly reads
 * jobs no cell needs and queues them in front of those it does. */
export const COLD_CANDIDATES_PER_STAGE = 1;

/** What every GitHub row derivation of one token and repo shares. */
export interface GithubContext extends RefreshClock {
  client: QueryClient;
  credentialId: string;
  repo: string;
  source: SourceRuleOf<'github'>;
  stages: readonly Stage[];
  rulesFor: (row: GithubRow, stageId: string) => CellRules;
  overBudget: boolean;
  /** A row's boost interval, if it is boosted (spec 0.2.0 §3.H). */
  boostOf: (rowId: string) => number | undefined;
}

/** A repo's runs as far as they've landed. */
interface RunsPages {
  /** The first page's query, landed or not. */
  first: Snapshot<Fetched<WorkflowRun[]>>;
  /** The pages that have landed, in order. */
  pages: Fetched<WorkflowRun[]>[];
  /** The pages to observe. */
  requests: Extract<GithubRequest, { call: 'runs' }>[];
}

/** The repo's runs pages that have landed, and the requests to observe. */
export function runsPages(ctx: GithubContext): RunsPages {
  const pages: Fetched<WorkflowRun[]>[] = [];
  const requests: RunsPages['requests'] = [];
  const first = githubSnapshot(ctx.client, ctx.credentialId, {
    call: 'runs',
    repo: ctx.repo,
    page: 1,
  });
  for (let page = 1; page <= pagesFor(ctx.source.reader.runs); page += 1) {
    const request = { call: 'runs', repo: ctx.repo, page } as const;
    requests.push(request);
    const data =
      page === 1
        ? first.data
        : githubSnapshot(ctx.client, ctx.credentialId, request).data;
    if (!data) break;
    pages.push(data);
    if (!data.hasNext) break;
  }
  return { first, pages, requests };
}

/** The problem for a renamed repo, when its runs say it moved. */
function renamedProblem(
  row: GithubRow,
  first: Fetched<WorkflowRun[]>,
): Problem | undefined {
  const now = first.data[0]?.repository?.full_name;
  const renamed =
    now !== undefined && now.toLowerCase() !== row.repo.toLowerCase();
  if (renamed)
    return rowProblem(
      row.id,
      `${row.repo} was renamed to ${now}: re-pick the repo`,
      false,
    );
  if (first.redirected && now === undefined)
    return rowProblem(
      row.id,
      `${row.repo} has moved (GitHub redirected): re-pick the repo`,
      false,
    );
  return undefined;
}

/** One cell: walk the candidates, asking for the jobs it needs. */
function deriveStage(
  ctx: GithubContext,
  rules: CellRules,
  candidates: { candidates: Candidate[]; keepDeep: boolean },
  need: (need: Need) => void,
  problems: Problem[],
  rowId: string,
): CellView | undefined {
  if (rules.stage === undefined)
    return finalView(
      deriveCell({ placed: undefined, set: rules.set, credentialStatus: 'ok' }),
    );
  const deep = needsItems(rules);
  const unknown: Candidate[] = [];
  let found: PlacedRecord | undefined;
  for (const candidate of candidates.candidates) {
    if (!deep && !placed(candidate.shallow, rules)) continue;
    const jobs = jobsOf(ctx, candidate.run);
    const freshness =
      candidate.run.status === 'completed'
        ? SETTLED
        : pollEvery(ACTIVE_INTERVAL_MS, ctx.overBudget);
    const observe = unknown.length < COLD_CANDIDATES_PER_STAGE || jobs.full;
    if (observe)
      for (const request of jobs.requests)
        need({
          key: githubKey(ctx.credentialId, request),
          freshness,
          version: candidate.run.status ?? '',
        });
    if (jobs.failure) {
      const failureNote = failureProblem(
        jobs.failure,
        rowId,
        `${ctx.repo} run ${String(candidate.run.id)}`,
      );
      if (failureNote) problems.push(failureNote);
      return failedView(jobs.failure, rules.set);
    }
    if (!jobs.full) {
      unknown.push(candidate);
      continue;
    }
    const record = jobs.full.record;
    if (candidates.keepDeep && !evaluateRule(ctx.source.keep, record)) continue;
    found = placeCell([record], rules);
    if (found) break;
  }
  const view = finalView(
    deriveCell({ placed: found, set: rules.set, credentialStatus: 'ok' }),
  );
  const first = unknown.at(0);
  if (!first) return view;
  if (found) return { ...view, refreshing: true, pending: true };
  const provisional = deep
    ? undefined
    : provisionalCell(rules.set, first.run, first.shallow);
  if (!provisional) return undefined;
  return {
    derivation: provisional.result,
    active: provisional.result.status.summary.inProgress,
    provisional: provisional.look,
    pending: true,
  };
}

/** `row` derived from the cache. */
export function deriveGithubRow(
  ctx: GithubContext,
  row: GithubRow,
): RowDerivation {
  const runs = runsPages(ctx);
  const setFor = (stageId: string) => ctx.rulesFor(row, stageId).set;
  const boost = ctx.boostOf(row.id);
  const rootNeeds = (active: boolean): Need[] =>
    runs.requests.map((request) => ({
      key: githubKey(ctx.credentialId, request),
      freshness: boostedRootFreshness(active, ctx.overBudget, boost),
      root: true,
    }));
  const failure = failureOutcome(runs.first.failed, runs.first.error);
  if (failure)
    return failedDerivation(
      failure,
      { id: row.id, stages: ctx.stages },
      setFor,
      row.repo,
      rootNeeds(false),
    );
  const firstPage = runs.first.data;
  if (!firstPage) return { cells: {}, needs: rootNeeds(false), problems: [] };

  const candidates = githubCandidates(ctx.source, runs.pages);
  const needs: Need[] = [];
  const problems: Problem[] = [];
  const derived: Record<string, CellView> = {};
  for (const stage of ctx.stages) {
    const view = deriveStage(
      ctx,
      ctx.rulesFor(row, stage.id),
      candidates,
      (n) => needs.push(n),
      problems,
      row.id,
    );
    if (view) derived[stage.id] = view;
  }
  const active = Object.values(derived).some((cell) => cell.active);
  const freshness = rootFreshness(active, ctx.overBudget);
  const cells = markRefreshing(
    derived,
    runs.requests.some((request) =>
      isRefreshing(
        githubSnapshot(ctx.client, ctx.credentialId, request),
        freshness,
        ctx,
      ),
    ),
  );
  const renamed = renamedProblem(row, firstPage);
  if (renamed) problems.push(renamed);
  return {
    cells,
    needs: [...rootNeeds(active), ...needs],
    problems,
    refreshedAt: runs.first.updatedAt,
  };
}
