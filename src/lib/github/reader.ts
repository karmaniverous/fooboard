/**
 * GitHub read port: the calls fooboard's GitHub adapter makes (spec.md §5,
 * 4.3.2, 4.3.5, C-5, C-16) behind a narrow interface, plus the `fetch`-based
 * adapter that implements it. Callers depend on `GitHubReader`, not on the
 * HTTP client, so they can be tested with a plain fake fetch.
 *
 * @module
 */
import { GitHubValidationError } from './errors';
import { type FetchLike, GitHubHttpClient } from './httpClient';
import { type Page, paginateAll } from './pagination';
import type { RateLimitBudget } from './rateLimit';
import {
  type Branch,
  BranchesResponseSchema,
  type CompareApiResult,
  CompareSchema,
  type Job,
  JobsResponseSchema,
  type MatchingRef,
  MatchingRefsSchema,
  type Repo,
  ReposResponseSchema,
  type Workflow,
  type WorkflowRun,
  WorkflowRunsResponseSchema,
  WorkflowsResponseSchema,
} from './schemas';

const API_BASE = 'https://api.github.com';

/** A repository, identified the way every GitHub REST path needs it. */
export interface RepoRef {
  owner: string;
  repo: string;
}

/** Up to 10 commit subjects in each direction, plus the compare page link. */
export interface CompareResult {
  aheadBy: number;
  behindBy: number;
  htmlUrl: string;
  /** Subjects of commits `head` has that `base` lacks (newest first), up to 10. */
  aheadCommitSubjects: string[];
  /** Subjects of commits `base` has that `head` lacks (newest first), up to 10. */
  behindCommitSubjects: string[];
}

/** Read-only access to one GitHub credential's repos (spec.md §5). */
export interface GitHubReader {
  listWorkflowRuns(
    repo: RepoRef,
    opts?: { perPage?: number; excludePullRequests?: boolean },
  ): Promise<WorkflowRun[]>;
  listRunJobs(
    repo: RepoRef,
    runId: number,
    opts?: { filter?: 'latest' | 'all' },
  ): Promise<Job[]>;
  listWorkflows(repo: RepoRef): Promise<Workflow[]>;
  matchingRefs(repo: RepoRef, prefix: string): Promise<MatchingRef[]>;
  compare(repo: RepoRef, base: string, head: string): Promise<CompareResult>;
  listBranches(repo: RepoRef): Promise<Branch[]>;
  listRepos(): Promise<Repo[]>;
  /** Current rate-limit budget, or `undefined` before the first response. */
  getBudget(): RateLimitBudget | undefined;
  /** The token's expiry, if GitHub reports it (spec.md C-5), as an ISO/HTTP-date string. */
  getTokenExpiration(): string | undefined;
}

/** Credentials and options for a `GitHubReader`. */
export interface GitHubReaderConfig {
  token: string;
  /** Injectable for tests; defaults to the global `fetch`. */
  fetchImpl?: FetchLike;
  /** Fraction of the rate limit at/under which the budget reports `'low'`. Default `0.1`. */
  lowBudgetThreshold?: number;
}

function parse<T>(
  schema: { parse: (data: unknown) => T },
  path: string,
  data: unknown,
): T {
  try {
    return schema.parse(data);
  } catch (err) {
    throw new GitHubValidationError(
      path,
      err instanceof Error ? err.message : String(err),
    );
  }
}

function commitSubjects(result: CompareApiResult): string[] {
  return result.commits
    .slice(-10)
    .reverse()
    .map((c) => c.commit.message.split('\n')[0]);
}

/** Create a `GitHubReader` backed by plain `fetch` (browser-safe, no Octokit). */
export function createGitHubReader({
  token,
  fetchImpl,
  lowBudgetThreshold,
}: GitHubReaderConfig): GitHubReader {
  const http = new GitHubHttpClient({ token, fetchImpl, lowBudgetThreshold });

  async function getPage<T>(url: string): Promise<Page<T>> {
    const { data, headers } = await http.getJson(url);
    return { items: data as T[], linkHeader: headers.get('link') };
  }

  return {
    async listWorkflowRuns(
      { owner, repo }: RepoRef,
      { perPage = 100, excludePullRequests = true } = {},
    ) {
      const path = `${API_BASE}/repos/${owner}/${repo}/actions/runs?per_page=${String(
        perPage,
      )}&exclude_pull_requests=${String(excludePullRequests)}`;
      const { data } = await http.getJson(path);
      return parse(WorkflowRunsResponseSchema, path, data).workflow_runs;
    },

    async listRunJobs(
      { owner, repo }: RepoRef,
      runId: number,
      { filter = 'latest' } = {},
    ) {
      const path = `${API_BASE}/repos/${owner}/${repo}/actions/runs/${String(
        runId,
      )}/jobs?filter=${filter}`;
      const { data } = await http.getJson(path);
      return parse(JobsResponseSchema, path, data).jobs;
    },

    async listWorkflows({ owner, repo }: RepoRef) {
      const path = `${API_BASE}/repos/${owner}/${repo}/actions/workflows?per_page=100`;
      const { data } = await http.getJson(path);
      return parse(WorkflowsResponseSchema, path, data).workflows;
    },

    async matchingRefs({ owner, repo }: RepoRef, prefix: string) {
      const path = `${API_BASE}/repos/${owner}/${repo}/git/matching-refs/heads/${encodeURIComponent(
        prefix,
      )}`;
      const { data } = await http.getJson(path);
      return parse(MatchingRefsSchema, path, data);
    },

    async compare({ owner, repo }: RepoRef, base: string, head: string) {
      const forwardPath = `${API_BASE}/repos/${owner}/${repo}/compare/${encodeURIComponent(
        base,
      )}...${encodeURIComponent(head)}`;
      const reversePath = `${API_BASE}/repos/${owner}/${repo}/compare/${encodeURIComponent(
        head,
      )}...${encodeURIComponent(base)}`;
      const [forward, reverse] = await Promise.all([
        http.getJson(forwardPath),
        http.getJson(reversePath),
      ]);
      const forwardResult = parse(CompareSchema, forwardPath, forward.data);
      const reverseResult = parse(CompareSchema, reversePath, reverse.data);
      return {
        aheadBy: forwardResult.ahead_by,
        behindBy: forwardResult.behind_by,
        htmlUrl: forwardResult.html_url,
        aheadCommitSubjects: commitSubjects(forwardResult),
        behindCommitSubjects: commitSubjects(reverseResult),
      };
    },

    listBranches({ owner, repo }: RepoRef) {
      const firstUrl = `${API_BASE}/repos/${owner}/${repo}/branches?per_page=100`;
      return paginateAll<Branch>(firstUrl, async (url) => {
        const page = await getPage<unknown>(url);
        return {
          items: parse(BranchesResponseSchema, url, page.items),
          linkHeader: page.linkHeader,
        };
      });
    },

    listRepos() {
      const firstUrl = `${API_BASE}/user/repos?per_page=100`;
      return paginateAll<Repo>(firstUrl, async (url) => {
        const page = await getPage<unknown>(url);
        return {
          items: parse(ReposResponseSchema, url, page.items),
          linkHeader: page.linkHeader,
        };
      });
    },

    getBudget() {
      return http.getBudget();
    },

    getTokenExpiration() {
      return http.getTokenExpiration();
    },
  };
}
