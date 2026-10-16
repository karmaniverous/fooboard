/**
 * GitHub spike orchestration (spec.md §6 spike 2): the calls the board makes
 * (runs, jobs of the newest run, matching refs, compare), plus a repeated
 * runs request to show whether GitHub honoured the ETag. A `304` does not
 * count against the primary rate limit, so an unchanged `remaining` after
 * the repeat means the cache worked. Pure apart from the injected reader.
 *
 * @module
 */
import type { RateLimitBudget } from '@/lib/github/rateLimit';
import type { GitHubReader } from '@/lib/github/reader';

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

/** Run the spike's read chain against one repo. */
export async function runGithubSpike(
  reader: GitHubReader,
  { owner, repo, branchPrefix }: GithubSpikeTarget,
): Promise<GithubSpikeResult> {
  const ref = { owner, repo };
  const prefix = branchPrefix || 'main';

  const runs = await reader.listWorkflowRuns(ref, {
    perPage: 100,
    excludePullRequests: true,
  });
  const newest = runs.at(0);
  const jobs = newest
    ? await reader.listRunJobs(ref, newest.id, { filter: 'latest' })
    : [];
  const refs = await reader.matchingRefs(ref, prefix);
  const head = refs[0]?.ref.replace(/^refs\/heads\//, '') ?? 'main';
  const compare = await reader.compare(ref, 'main', head);

  const budgetBefore = reader.getBudget();
  await reader.listWorkflowRuns(ref, {
    perPage: 100,
    excludePullRequests: true,
  });
  const budgetAfter = reader.getBudget();

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
      aheadBy: compare.aheadBy,
      behindBy: compare.behindBy,
    },
    budgetBefore,
    budgetAfter,
    notModifiedHonoured:
      budgetBefore && budgetAfter
        ? budgetAfter.remaining === budgetBefore.remaining
        : undefined,
    tokenExpiration: reader.getTokenExpiration(),
  };
}
