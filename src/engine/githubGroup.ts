/**
 * What one GitHub token's read of a repo yields beyond its rows' cells
 * (spec.md §2.5, §3.1, §3.11): the Unmapped runs (judged with their jobs
 * when those are cached, else from the run alone) against only the cells
 * that read with the token, the runs those cells place (so a run another
 * token's cells place isn't listed), translation problems, and window
 * hints for the token's cells when the runs window came back full.
 * Recomputed with the rows the repo's queries feed. Pure.
 *
 * @module
 */
import type { GithubRow } from '@/domain/config/row';
import { rowReasons } from '@/domain/derivation';
import type { KeyProblem } from '@/domain/model/translate';
import type { Problem } from '@/domain/problems/problem';
import { translationProblems } from '@/domain/problems/runtime';
import { mapWorkflowRun } from '@/lib/github';

import { githubCandidates } from './githubCandidates';
import { jobsOf } from './githubJobs';
import { type GithubContext, runsPages } from './githubRow';
import type { CellView, UnmappedRun } from './types';
import { fullReadHints, servedBy } from './windowHints';

export interface GroupResult {
  unmapped: UnmappedRun[];
  /** The ids of the runs the token's cells place (`UnmappedRun.id`). */
  mapped: string[];
  problems: Problem[];
}

/** A row reading the repo with the group's token, and its columns that
 * do. */
export interface GithubReader {
  row: GithubRow;
  stageIds: readonly string[];
}

/** The group's Unmapped runs and problems. `readers` are the rows
 * reading the repo with the token, each with its columns that do (a run
 * is unmapped only if none of those cells places it); `cells` are the
 * rows' derived cells. */
export function githubGroup(
  ctx: GithubContext,
  readers: readonly GithubReader[],
  cells: (rowId: string) => Readonly<Partial<Record<string, CellView>>>,
): GroupResult {
  const { pages } = runsPages(ctx);
  if (pages.length === 0) return { unmapped: [], mapped: [], problems: [] };
  const { candidates, keyProblems, full } = githubCandidates(ctx.source, pages);
  const rulesByRow = readers.map(({ row, stageIds }) => ({
    rowId: row.id,
    cells: stageIds.map((s) => ctx.rulesFor(row, s)),
  }));
  const itemProblems: KeyProblem[] = [];
  const unmapped: UnmappedRun[] = [];
  const placed: string[] = [];
  for (const { run, shallow } of candidates) {
    const known = jobsOf(ctx, run).full;
    if (known) itemProblems.push(...known.problems);
    const record = known?.record ?? shallow;
    const reasons = rowReasons(record, rulesByRow, known !== undefined);
    const id = `github:${ctx.repo}#${String(run.id)}`;
    const first = reasons?.at(0);
    if (!reasons || !first) {
      placed.push(id);
      continue;
    }
    const mapped = mapWorkflowRun(run);
    unmapped.push({
      provider: 'github',
      id,
      where: ctx.repo,
      title: mapped.workflowName,
      branch: mapped.headBranch,
      htmlUrl: mapped.htmlUrl,
      record,
      reason: first.reason,
      rows: reasons,
    });
  }
  const hints = fullReadHints(() => full, servedBy(readers), cells, ctx.source);
  return {
    unmapped,
    mapped: placed,
    problems: [
      ...translationProblems(ctx.source, [...keyProblems, ...itemProblems]),
      ...hints,
    ],
  };
}
