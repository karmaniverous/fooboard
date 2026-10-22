/**
 * One GitHub row derived from the cache (spec.md §3.1, §2.3): its repo's
 * runs pages (page 1, then each next page while the window needs it),
 * then per cell a walk over the candidates newest first. A run that
 * passes the cell's record and stage rules needs its jobs: the walk asks
 * for the jobs of up to `COLD_CANDIDATES_PER_STAGE` runs it can't judge
 * yet, and goes on past them only to find a cached placement. Until the
 * jobs land, a cell whose rules don't test items shows its run's state
 * provisionally (Decision 37), or its cached placement marked refreshing.
 * Pure: reads the cache, never fetches.
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
import { type Problem, problem } from '@/domain/problems/problem';
import { evaluateRule } from '@/domain/rules/check';
import { type Fetched, pagesFor, type WorkflowRun } from '@/lib/github';
import { githubSnapshot } from '@/query/cache';
import {
  ACTIVE_INTERVAL_MS,
  pollEvery,
  rootFreshness,
  SETTLED,
} from '@/query/intervals';
import { githubKey } from '@/query/keys';

import { finalView } from './cells';
import { type Candidate, githubCandidates } from './githubCandidates';
import { jobsOf } from './githubJobs';
import type { Need, RowDerivation } from './need';
import {
  failedView,
  failedViews,
  failureOutcome,
  failureProblem,
} from './providerOutcome';
import { provisionalCell } from './provisional';
import type { CellView } from './types';

/** Runs per cell whose jobs load at once on a cold cache (Decision 37),
 * set from measurement on a 16-repo board at 10 requests in flight: 1
 * filled it in 27 s with 228 requests, 2 in 37 s (327), 3 in 47 s (411).
 * The stages of a row share candidates, so reading ahead mostly reads
 * jobs no cell needs and queues them in front of those it does. */
export const COLD_CANDIDATES_PER_STAGE = 1;

/** What every GitHub row derivation of one token and repo shares. */
export interface GithubContext {
  client: QueryClient;
  credentialId: string;
  repo: string;
  source: SourceRuleOf<'github'>;
  stages: readonly Stage[];
  rulesFor: (row: GithubRow, stageId: string) => CellRules;
  overBudget: boolean;
  /** When the board opened: older data is shown as refreshing. */
  openedAt: number;
}

/** The repo's runs pages that have landed, and the requests to observe. */
export function runsPages(ctx: GithubContext) {
  const pages: Fetched<WorkflowRun[]>[] = [];
  const requests = [];
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
  const scope = { kind: 'row', id: row.id } as const;
  const renamed =
    now !== undefined && now.toLowerCase() !== row.repo.toLowerCase();
  if (renamed)
    return problem(
      scope,
      `${row.repo} was renamed to ${now}: re-pick the repo`,
      false,
      {
        target: scope,
      },
    );
  if (first.redirected && now === undefined)
    return problem(
      scope,
      `${row.repo} has moved (GitHub redirected): re-pick the repo`,
      false,
      {
        target: scope,
      },
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
  const rootNeeds = (active: boolean): Need[] =>
    runs.requests.map((request) => ({
      key: githubKey(ctx.credentialId, request),
      freshness: rootFreshness(active, ctx.overBudget),
    }));
  const failure = failureOutcome(runs.first.failed, runs.first.error);
  if (failure) {
    const note = failureProblem(failure, row.id, row.repo);
    return {
      cells: failedViews(failure, ctx.stages, setFor),
      needs: rootNeeds(false),
      problems: note ? [note] : [],
    };
  }
  const firstPage = runs.first.data;
  if (!firstPage) return { cells: {}, needs: rootNeeds(false), problems: [] };

  const candidates = githubCandidates(ctx.source, runs.pages);
  const needs: Need[] = [];
  const problems: Problem[] = [];
  const refreshing = runs.first.updatedAt < ctx.openedAt;
  const cells: Record<string, CellView> = {};
  for (const stage of ctx.stages) {
    const view = deriveStage(
      ctx,
      ctx.rulesFor(row, stage.id),
      candidates,
      (n) => needs.push(n),
      problems,
      row.id,
    );
    if (view)
      cells[stage.id] = refreshing ? { ...view, refreshing: true } : view;
  }
  const active = Object.values(cells).some((cell) => cell.active);
  const renamed = renamedProblem(row, firstPage);
  if (renamed) problems.push(renamed);
  return {
    cells,
    needs: [...rootNeeds(active), ...needs],
    problems,
    refreshedAt: runs.first.updatedAt,
  };
}
