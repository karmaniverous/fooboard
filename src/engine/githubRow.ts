/**
 * One GitHub repo's refresh (spec.md A§4.3.7): read its recent runs once,
 * translate each into a record with the GitHub source rule, and place
 * records in every cell of the rows reading it, newest first by the order
 * key. A run's jobs are read only when a cell needs them (its rules test
 * items, or the run passes its record and stage rules), and once per run.
 *
 * @module
 */
import type { JSONValue } from 'json-p3';
import { objectify } from 'radash';

import type { GithubRow } from '@/domain/config/row';
import type { Stage } from '@/domain/config/stage';
import {
  type CellDerivation,
  type CredentialStatus,
  deriveCell,
  type GithubWorkflowRun,
  isExcludedEvent,
  type ProviderFailure,
  unmappedReason,
} from '@/domain/derivation';
import {
  type CellRules,
  needsItems,
  placeCell,
  placed,
  ruleNeedsItems,
} from '@/domain/model/cell';
import { asJson } from '@/domain/model/json';
import type { SourceRule } from '@/domain/model/sourceRule';
import {
  compareOrder,
  type RecordDoc,
  translate,
} from '@/domain/model/translate';
import { evaluateRule } from '@/domain/rules/check';
import { inProgress } from '@/domain/statuses/resolved';
import {
  GitHubAuthError,
  type GitHubReader,
  mapRunWithJobs,
  mapWorkflowRun,
  RateLimitedError,
  type WorkflowRun,
} from '@/lib/github';

import { failureOutcome } from './providerOutcome';
import type { UnmappedRun } from './types';

/** A branch and when it last ran, for branch suggestions. */
interface DatedBranch {
  name: string;
  updatedAt: string;
}

interface CellView {
  derivation: CellDerivation;
  active: boolean;
}

export interface GithubRepoRefresh {
  kind: 'refreshed';
  rows: Record<string, Record<string, CellView>>;
  unmapped: UnmappedRun[];
  branches: DatedBranch[];
}

export interface GithubRepoRateLimited {
  kind: 'rate-limited';
}

export const repoRef = (repo: string): { owner: string; repo: string } => {
  const [owner = '', name = ''] = repo.split('/');
  return { owner, repo: name };
};

/** A cell's rules (placement, status set, order key). */
type RulesFor = (row: GithubRow, stageId: string) => CellRules;

/** What a GitHub refresh needs besides the reader. */
export interface GithubRepoInput {
  rows: readonly GithubRow[];
  /** Every row reading the repo (for Unmapped). */
  repoRows: readonly GithubRow[];
  stages: readonly Stage[];
  rulesFor: RulesFor;
  source: SourceRule;
}

function emptyRows(
  input: GithubRepoInput,
  credentialStatus: CredentialStatus,
  providerFailure?: ProviderFailure,
): GithubRepoRefresh {
  const cellsOf = (row: GithubRow) =>
    objectify(
      input.stages,
      (s) => s.id,
      (s): CellView => ({
        active: false,
        derivation: deriveCell({
          placed: undefined,
          set: input.rulesFor(row, s.id).set,
          credentialStatus,
          providerFailure,
        }),
      }),
    );
  return {
    kind: 'refreshed',
    rows: objectify(input.rows, (r) => r.id, cellsOf),
    unmapped: [],
    branches: [],
  };
}

export async function refreshGithubRepo(
  input: GithubRepoInput,
  reader: GitHubReader | undefined,
): Promise<GithubRepoRefresh | GithubRepoRateLimited> {
  if (!reader) return emptyRows(input, 'missing');
  try {
    return await refreshWith(input, reader);
  } catch (err) {
    const outcome = failureOutcome(err, {
      isRateLimit: (e) => e instanceof RateLimitedError,
      isAuth: (e) => e instanceof GitHubAuthError,
    });
    return outcome.kind === 'rate-limited'
      ? outcome
      : emptyRows(input, outcome.credentialStatus, outcome.providerFailure);
  }
}

interface Candidate {
  run: WorkflowRun;
  mapped: GithubWorkflowRun;
  /** The record without jobs, for rules that don't test items. */
  shallow: RecordDoc;
}

async function refreshWith(
  input: GithubRepoInput,
  reader: GitHubReader,
): Promise<GithubRepoRefresh> {
  const { source } = input;
  const runs = source.provider === 'github' ? source.reader.runs : 100;
  const repo = input.rows[0]?.repo ?? '';
  const ref = repoRef(repo);
  const raw = (
    await reader.listWorkflowRuns(ref, {
      perPage: 100,
      pages: Math.ceil(runs / 100),
      excludePullRequests: true,
    })
  ).slice(0, runs);
  const keepDeep = ruleNeedsItems(source.keep);
  const excludePrs =
    source.provider === 'github' && source.reader.excludePullRequests;
  const order = (r: RecordDoc): JSONValue => r[source.order] ?? null;
  const candidates: Candidate[] = raw
    .filter((r) => !(excludePrs && isExcludedEvent(r.event)))
    .map((r) => {
      const mapped = mapWorkflowRun(r);
      const shallow = translate(
        source,
        asJson({ run: mapped, jobs: [] }),
      ).record;
      return { run: r, mapped, shallow };
    })
    // Keep, when it can judge a run without its jobs; otherwise below.
    .filter((c) => keepDeep || evaluateRule(source.keep, c.shallow))
    .sort((a, b) => compareOrder(order(b.shallow), order(a.shallow)));
  const branchNames = (await reader.listBranches(ref)).map((b) => b.name);

  const fetched = new Map<number, Promise<RecordDoc>>();
  const full = (run: WorkflowRun): Promise<RecordDoc> => {
    let pending = fetched.get(run.id);
    if (!pending) {
      pending = reader
        .listRunJobs(ref, run.id, { filter: 'latest' })
        .then(
          (jobs) => translate(source, asJson(mapRunWithJobs(run, jobs))).record,
        );
      fetched.set(run.id, pending);
    }
    return pending;
  };

  const cellFor = async (row: GithubRow, stage: Stage): Promise<CellView> => {
    const rules = input.rulesFor(row, stage.id);
    const set = rules.set;
    let found: ReturnType<typeof placeCell>;
    if (rules.stage !== undefined) {
      const deep = needsItems(rules);
      for (const c of candidates) {
        if (!deep && !placed(c.shallow, rules)) continue;
        const record = await full(c.run);
        if (keepDeep && !evaluateRule(source.keep, record)) continue;
        found = placeCell([record], rules);
        if (found) break;
      }
    }
    const derivation = deriveCell({
      placed: found,
      set,
      credentialStatus: 'ok',
    });
    return { derivation, active: inProgress(derivation) };
  };

  const result: Record<string, Record<string, CellView>> = {};
  for (const row of input.rows) {
    const cells: Record<string, CellView> = {};
    for (const stage of input.stages)
      cells[stage.id] = await cellFor(row, stage);
    result[row.id] = cells;
  }

  const allRules = input.repoRows.flatMap((row) =>
    input.stages.map((s) => input.rulesFor(row, s.id)),
  );
  const unmapped: UnmappedRun[] = [];
  for (const c of candidates) {
    const pending = fetched.get(c.run.id);
    const record = pending ? await pending : c.shallow;
    const reason = unmappedReason(record, allRules, pending !== undefined);
    if (!reason) continue;
    unmapped.push({
      repo,
      runId: c.run.id,
      workflowName: c.mapped.workflowName,
      branch: c.mapped.headBranch,
      htmlUrl: c.mapped.htmlUrl,
      reason,
    });
  }
  return {
    kind: 'refreshed',
    rows: result,
    unmapped,
    branches: datedBranches(
      branchNames,
      candidates.map((c) => c.mapped),
    ),
  };
}

function datedBranches(
  names: readonly string[],
  runs: readonly GithubWorkflowRun[],
): DatedBranch[] {
  const newest = new Map<string, string>();
  for (const run of runs) {
    if (run.headBranch && !newest.has(run.headBranch)) {
      newest.set(run.headBranch, run.createdAt);
    }
  }
  return names.map((name) => ({
    name,
    updatedAt: newest.get(name) ?? new Date(0).toISOString(),
  }));
}
