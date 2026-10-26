/**
 * GitHub request port (spec.md §3.1): one method per HTTP request the
 * query layer makes, each conditional on the ETag the caller kept, plus
 * the `fetch`-based adapter. A page of a list is one request; whether the
 * list goes on is reported with the page. Callers depend on `GitHubApi`,
 * so the demo and tests can stand in for GitHub.
 *
 * @module
 */
import { GITHUB_API_BASE } from '@/lib/transport';

import { GitHubValidationError } from './errors';
import { type FetchLike, GitHubHttpClient } from './httpClient';
import { parseLinkHeader } from './pagination';
import type { RateLimitBudget } from './rateLimit';
import {
  type Branch,
  BranchesResponseSchema,
  type CompareApiResult,
  CompareSchema,
  type Job,
  JobsResponseSchema,
  type Repo,
  ReposResponseSchema,
  type WorkflowRun,
  WorkflowRunsResponseSchema,
} from './schemas';

/** The most items GitHub's REST API returns per page. */
export const GITHUB_PER_PAGE = 100;

/** Pages of `GITHUB_PER_PAGE` needed to read `count` items. */
export const pagesFor = (count: number): number =>
  Math.ceil(count / GITHUB_PER_PAGE);

/** A repository, identified the way every GitHub REST path needs it. */
export interface RepoRef {
  owner: string;
  repo: string;
}

/** `owner/name` as a `RepoRef`. */
export const repoRef = (repo: string): RepoRef => {
  const [owner = '', name = ''] = repo.split('/');
  return { owner, repo: name };
};

/** One request's answer: the parsed body, the ETag to send next time,
 * whether the list goes on past this page, and whether GitHub redirected
 * (a renamed repo, Decision 26). */
export interface Fetched<T> {
  notModified: false;
  data: T;
  etag: string | null;
  hasNext: boolean;
  redirected: boolean;
}

/** GitHub answered `304`: the data cached with the ETag still holds. */
interface NotModified {
  notModified: true;
}

export type Conditional<T> = Fetched<T> | NotModified;

/** One GitHub credential's requests (spec.md §3.1 keys). */
export interface GitHubApi {
  /** A page of the repo's workflow runs, pull-request runs excluded. */
  runsPage(
    repo: RepoRef,
    page: number,
    etag?: string | null,
  ): Promise<Conditional<WorkflowRun[]>>;
  /** A page of the jobs of one attempt of a run: a rerun can't mix its
   * jobs into the attempt the caller asked for. */
  jobsPage(
    repo: RepoRef,
    runId: number,
    attempt: number,
    page: number,
    etag?: string | null,
  ): Promise<Conditional<Job[]>>;
  /** `base...head`: commits `head` has that `base` lacks. */
  compare(
    repo: RepoRef,
    base: string,
    head: string,
    etag?: string | null,
  ): Promise<Conditional<CompareApiResult>>;
  branchesPage(
    repo: RepoRef,
    page: number,
    etag?: string | null,
  ): Promise<Conditional<Branch[]>>;
  reposPage(page: number, etag?: string | null): Promise<Conditional<Repo[]>>;
}

/** Credentials and options for a `GitHubApi`. */
export interface GitHubApiConfig {
  token: string;
  fetchImpl?: FetchLike;
  /** The REST API base (the transport's, spec.md §3.14); GitHub's
   * public API unless given. */
  apiBase?: string;
  onBudget?: (budget: RateLimitBudget) => void;
}

/** Encode a branch name for a URL path, keeping its `/` separators
 * (GitHub expects `release/24.3`, not `release%2F24.3`). */
const encodeRef = (ref: string): string =>
  ref.split('/').map(encodeURIComponent).join('/');

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

const pageQuery = (page: number): string =>
  `per_page=${String(GITHUB_PER_PAGE)}&page=${String(page)}`;

export function createGitHubApi({
  token,
  fetchImpl,
  apiBase = GITHUB_API_BASE,
  onBudget,
}: GitHubApiConfig): GitHubApi {
  const http = new GitHubHttpClient({ token, fetchImpl, onBudget });
  const repoUrl = ({ owner, repo }: RepoRef, suffix: string): string =>
    `${apiBase}/repos/${owner}/${repo}/${suffix}`;

  /** One conditional GET; `hasNext` from the page or its `Link`. */
  const get = async <P, T>(
    url: string,
    etag: string | null | undefined,
    schema: Parser<P>,
    pick: (body: P) => T,
    hasNext: (items: T, link: string | null) => boolean = () => false,
  ): Promise<Conditional<T>> => {
    const res = await http.get(url, etag);
    if (res.notModified) return res;
    const data = pick(parse(schema, url, res.data));
    return {
      notModified: false,
      data,
      etag: res.etag,
      hasNext: hasNext(data, res.link),
      redirected: res.redirected,
    };
  };
  const linkNext = (_items: unknown, link: string | null): boolean =>
    'next' in parseLinkHeader(link);
  const asIs = <T>(body: T): T => body;

  return {
    runsPage: (ref, page, etag) =>
      get(
        repoUrl(
          ref,
          `actions/runs?${pageQuery(page)}&exclude_pull_requests=true`,
        ),
        etag,
        WorkflowRunsResponseSchema,
        (body) => body.workflow_runs,
        // Runs are read page by page until a short page.
        (runs) => runs.length >= GITHUB_PER_PAGE,
      ),
    jobsPage: (ref, runId, attempt, page, etag) =>
      get(
        repoUrl(
          ref,
          `actions/runs/${String(runId)}/attempts/${String(attempt)}/jobs?${pageQuery(page)}`,
        ),
        etag,
        JobsResponseSchema,
        (body) => body.jobs,
        linkNext,
      ),
    compare: (ref, base, head, etag) =>
      get(
        repoUrl(ref, `compare/${encodeRef(base)}...${encodeRef(head)}`),
        etag,
        CompareSchema,
        asIs,
      ),
    branchesPage: (ref, page, etag) =>
      get(
        repoUrl(ref, `branches?${pageQuery(page)}`),
        etag,
        BranchesResponseSchema,
        asIs<Branch[]>,
        linkNext,
      ),
    reposPage: (page, etag) =>
      get(
        `${apiBase}/user/repos?${pageQuery(page)}`,
        etag,
        ReposResponseSchema,
        asIs<Repo[]>,
        linkNext,
      ),
  };
}
