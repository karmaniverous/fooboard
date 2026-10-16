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
import { paginateAll } from './pagination';
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
  fetchImpl?: FetchLike;
}

/** Encode a branch name or prefix for a URL path, keeping its `/`
 * separators (GitHub expects `heads/release/`, not `heads/release%2F`). */
const encodeRef = (ref: string): string =>
  ref.split('/').map(encodeURIComponent).join('/');

const repoUrl = ({ owner, repo }: RepoRef, suffix: string): string =>
  `${API_BASE}/repos/${owner}/${repo}/${suffix}`;

type Parser<T> = { parse: (data: unknown) => T };

function parse<T>(schema: Parser<T>, path: string, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (err) {
    throw new GitHubValidationError(
      path,
      err instanceof Error ? err.message : String(err),
    );
  }
}

/** The newest ten commit subjects of a compare (GitHub lists oldest first). */
function commitSubjects(result: CompareApiResult): string[] {
  return result.commits
    .slice(-10)
    .reverse()
    .map((c) => c.commit.message.split('\n')[0]);
}

export function createGitHubReader({
  token,
  fetchImpl,
}: GitHubReaderConfig): GitHubReader {
  const http = new GitHubHttpClient({ token, fetchImpl });

  const get = async <T>(path: string, schema: Parser<T>): Promise<T> =>
    parse(schema, path, (await http.getJson(path)).data);

  const getAll = <T>(firstUrl: string, schema: Parser<T[]>): Promise<T[]> =>
    paginateAll<T>(firstUrl, async (url) => {
      const { data, headers } = await http.getJson(url);
      return {
        items: parse(schema, url, data),
        linkHeader: headers.get('link'),
      };
    });

  /** `base...head`: commits on `head` that `base` lacks. */
  const compareOnce = (ref: RepoRef, base: string, head: string) =>
    get(
      repoUrl(ref, `compare/${encodeRef(base)}...${encodeRef(head)}`),
      CompareSchema,
    );

  return {
    async listWorkflowRuns(
      ref,
      { perPage = 100, excludePullRequests = true } = {},
    ) {
      const query = `per_page=${String(perPage)}&exclude_pull_requests=${String(excludePullRequests)}`;
      return (
        await get(
          repoUrl(ref, `actions/runs?${query}`),
          WorkflowRunsResponseSchema,
        )
      ).workflow_runs;
    },

    async listRunJobs(ref, runId, { filter = 'latest' } = {}) {
      return (
        await get(
          repoUrl(ref, `actions/runs/${String(runId)}/jobs?filter=${filter}`),
          JobsResponseSchema,
        )
      ).jobs;
    },

    async listWorkflows(ref) {
      return (
        await get(
          repoUrl(ref, 'actions/workflows?per_page=100'),
          WorkflowsResponseSchema,
        )
      ).workflows;
    },

    matchingRefs: (ref, prefix) =>
      get(
        repoUrl(ref, `git/matching-refs/heads/${encodeRef(prefix)}`),
        MatchingRefsSchema,
      ),

    /** Counts come from `base...head`; the reverse compare supplies the
     * subjects of commits `base` has that `head` lacks. Both are cached
     * by ETag, so an unchanged pair costs nothing on later polls. */
    async compare(ref, base, head) {
      const [forward, reverse] = await Promise.all([
        compareOnce(ref, base, head),
        compareOnce(ref, head, base),
      ]);
      return {
        aheadBy: forward.ahead_by,
        behindBy: forward.behind_by,
        htmlUrl: forward.html_url,
        aheadCommitSubjects: commitSubjects(forward),
        behindCommitSubjects: commitSubjects(reverse),
      };
    },

    listBranches: (ref) =>
      getAll<Branch>(
        repoUrl(ref, 'branches?per_page=100'),
        BranchesResponseSchema,
      ),

    listRepos: () =>
      getAll<Repo>(`${API_BASE}/user/repos?per_page=100`, ReposResponseSchema),

    getBudget: () => http.getBudget(),
    getTokenExpiration: () => http.getTokenExpiration(),
  };
}
