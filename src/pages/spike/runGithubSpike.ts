/**
 * GitHub spike orchestration (spec.md §6 spike 2): the calls the board makes
 * (runs, jobs of the newest run, matching refs, compare), plus a repeated
 * runs request to show whether GitHub honoured the ETag. A `304` does not
 * count against the primary rate limit, so an unchanged `remaining` after
 * the repeat means the conditional request worked. Pure apart from the
 * injected request port and budget.
 *
 * @module
 */
import type { Conditional, GitHubApi } from '@/lib/github/api';
import type { RateLimitBudget } from '@/lib/github/rateLimit';

/** What the spike needs besides the token. */
export interface GithubSpikeTarget {
  owner: string;
  repo: string;
  /** Branch prefix for `matching-refs`; `main` when omitted or blank. */
  branchPrefix?: string;
}

/** Everything the spike page shows. */
export interface GithubSpikeResult {
  runs: { id: number; name: string; branch: string; status: string }[];
  newestRunJobs: { name: string; status: string; conclusion: string | null }[];
  matchingRefs: string[];
  compare: { base: string; head: string; aheadBy: number; behindBy: number };
  budgetBefore: RateLimitBudget | undefined;
  budgetAfter: RateLimitBudget | undefined;
  /** `true` when the repeated request left `remaining` unchanged (a `304`). */
  notModifiedHonoured: boolean | undefined;
  tokenExpiration: string | undefined;
}

/** The data of a request made without an ETag (never a 304). */
const dataOf = <T>(res: Conditional<T>, none: T): T =>
  res.notModified ? none : res.data;

/** Run the spike's read chain against one repo; `budget` reads the last
 * budget a response reported. */
export async function runGithubSpike(
  api: GitHubApi,
  budget: () => RateLimitBudget | undefined,
  { owner, repo, branchPrefix }: GithubSpikeTarget,
): Promise<GithubSpikeResult> {
  const ref = { owner, repo };
  const prefix = branchPrefix || 'main';

  const first = await api.runsPage(ref, 1);
  const runs = dataOf(first, []);
  const newest = runs.at(0);
  const jobs = newest ? dataOf(await api.jobsPage(ref, newest.id, 1), []) : [];
  const refs = await api.matchingRefs(ref, prefix);
  const head = refs[0]?.ref.replace(/^refs\/heads\//, '') ?? 'main';
  const compare = dataOf(await api.compare(ref, 'main', head), undefined);

  const budgetBefore = budget();
  await api.runsPage(ref, 1, first.notModified ? undefined : first.etag);
  const budgetAfter = budget();

  return {
    runs: runs.slice(0, 5).map((r) => ({
      id: r.id,
      name: r.name ?? '',
      branch: r.head_branch ?? '',
      status: r.conclusion ?? r.status ?? '',
    })),
    newestRunJobs: jobs.map((j) => ({
      name: j.name,
      status: j.status,
      conclusion: j.conclusion ?? null,
    })),
    matchingRefs: refs.map((r) => r.ref),
    compare: {
      base: 'main',
      head,
      aheadBy: compare?.ahead_by ?? 0,
      behindBy: compare?.behind_by ?? 0,
    },
    budgetBefore,
    budgetAfter,
    notModifiedHonoured:
      budgetBefore && budgetAfter
        ? budgetAfter.remaining === budgetBefore.remaining
        : undefined,
    tokenExpiration: api.getTokenExpiration(),
  };
}
