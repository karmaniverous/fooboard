/**
 * What one GitHub token's read of a repo yields beyond its rows' cells
 * (spec.md §2.5, §3.1): the Unmapped runs (judged with their jobs when
 * those are cached, else from the run alone), translation problems, and
 * window hints when the runs window came back full. Recomputed with the
 * rows the repo's queries feed. Pure.
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
import { fullReadHints } from './windowHints';

export interface GroupResult {
  unmapped: UnmappedRun[];
  problems: Problem[];
}

/** The group's Unmapped runs and problems. `rows` are the token's rows
 * reading the repo, `repoRows` every row reading it (a run is unmapped
 * only if no row places it); `cells` are the rows' derived cells. */
export function githubGroup(
  ctx: GithubContext,
  rows: readonly GithubRow[],
  repoRows: readonly GithubRow[],
  cells: (
    rowId: string,
  ) => Readonly<Partial<Record<string, CellView>>> | undefined,
): GroupResult {
  const { pages } = runsPages(ctx);
  if (pages.length === 0) return { unmapped: [], problems: [] };
  const { candidates, keyProblems, full } = githubCandidates(ctx.source, pages);
  const rulesByRow = repoRows.map((row) => ({
    rowId: row.id,
    cells: ctx.stages.map((s) => ctx.rulesFor(row, s.id)),
  }));
  const itemProblems: KeyProblem[] = [];
  const unmapped: UnmappedRun[] = [];
  for (const { run, shallow } of candidates) {
    const known = jobsOf(ctx, run).full;
    if (known) itemProblems.push(...known.problems);
    const record = known?.record ?? shallow;
    const reasons = rowReasons(record, rulesByRow, known !== undefined);
    const first = reasons?.at(0);
    if (!reasons || !first) continue;
    const mapped = mapWorkflowRun(run);
    unmapped.push({
      provider: 'github',
      id: `github:${ctx.repo}#${String(run.id)}`,
      where: ctx.repo,
      title: mapped.workflowName,
      branch: mapped.headBranch,
      htmlUrl: mapped.htmlUrl,
      record,
      reason: first.reason,
      rows: reasons,
    });
  }
  const hints = fullReadHints(
    full,
    rows.map((row) => row.id),
    cells,
    ctx.source,
  );
  return {
    unmapped,
    problems: [
      ...translationProblems(ctx.source, [...keyProblems, ...itemProblems]),
      ...hints,
    ],
  };
}
