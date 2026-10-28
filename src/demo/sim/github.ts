/**
 * The simulated GitHub REST API (spec.md §3.14 *Request surface*): the
 * repos a token can see, a repo's branches, its workflow runs, a run
 * attempt's jobs and compares, each read from the world at the request's
 * time. Pages honour `per_page` and `page` and carry `Link` headers;
 * every answer carries an ETag and a matching `If-None-Match` gets `304`;
 * every answer to a known token carries its `x-ratelimit-*` headers,
 * `remaining` counted down by the tab's requests (a `304` is free, as on
 * GitHub) and reset hourly. A token the scenario rejects or doesn't know
 * answers `401`, a repo it can't see `404`, a faulted repo `500`, each
 * with GitHub's JSON error body.
 *
 * @module
 */
import {
  branchBody,
  compareBody,
  githubError,
  jobBodies,
  repoBody,
  runBody,
} from './githubPayloads';
import { branchAt, compareAt, repoHistory } from './history';
import {
  json,
  linkHeader,
  pageOf,
  positiveParam,
  type SimAnswer,
  STATUS,
  withEtag,
} from './http';
import { repoRuns } from './runs';
import type { DemoScenario, Repo } from './scenario';

/** GitHub's primary rate limit for a personal token, per hour. */
export const GITHUB_RATE_LIMIT = 5000;
/** The rate-limit window. */
const RATE_WINDOW_MS = 60 * 60_000;
/** GitHub's default and largest page sizes. */
const DEFAULT_PER_PAGE = 30;
const MAX_PER_PAGE = 100;
const MS_PER_SECOND = 1000;

/** The world a request is answered from. */
export interface SimWorld {
  scenario: DemoScenario;
  seed: number;
  /** Wall-clock ms of simulated time `t`. */
  at: (t: number) => number;
}

/** Each token's use of its hourly budget, for this tab. */
export interface RateBook {
  /** Count a request at wall time `now` (unless `free`); the headers. */
  charge(token: string, now: number, free: boolean): Record<string, string>;
  exhausted(token: string, now: number): boolean;
}

export function createRateBook(limit = GITHUB_RATE_LIMIT): RateBook {
  const windows = new Map<string, { resetAt: number; used: number }>();
  const windowOf = (token: string, now: number) => {
    const w = windows.get(token);
    if (w && now < w.resetAt) return w;
    const fresh = { resetAt: now + RATE_WINDOW_MS, used: 0 };
    windows.set(token, fresh);
    return fresh;
  };
  return {
    charge(token, now, free) {
      const w = windowOf(token, now);
      if (!free && w.used < limit) w.used += 1;
      return {
        'x-ratelimit-limit': String(limit),
        'x-ratelimit-remaining': String(limit - w.used),
        'x-ratelimit-used': String(w.used),
        'x-ratelimit-reset': String(Math.ceil(w.resetAt / MS_PER_SECOND)),
        'x-ratelimit-resource': 'core',
      };
    },
    exhausted: (token, now) => windowOf(token, now).used >= limit,
  };
}

const notFound = (): SimAnswer =>
  json(STATUS.notFound, githubError('Not Found', STATUS.notFound));

/** A page of `items` at `url`, with its `Link` header. */
function paged<T>(
  url: URL,
  items: readonly T[],
  body: (page: T[]) => unknown,
): SimAnswer {
  const perPage = Math.min(
    positiveParam(url, 'per_page', DEFAULT_PER_PAGE),
    MAX_PER_PAGE,
  );
  const page = positiveParam(url, 'page', 1);
  const link = linkHeader(url, page, Math.ceil(items.length / perPage));
  return json(
    STATUS.ok,
    body(pageOf(items, page, perPage)),
    link ? { link } : {},
  );
}

/** Answer one repo path (`rest` follows `/repos/{owner}/{name}/`). */
function repoRoute(
  world: SimWorld,
  repo: Repo,
  rest: string[],
  url: URL,
  t: number,
  apiBase: string,
): SimAnswer {
  if (repo.fault === 'serverError')
    return json(
      STATUS.serverError,
      githubError('Server Error', STATUS.serverError),
    );
  const history = repoHistory(world.scenario, world.seed, repo, t);
  const [first, second, runId, attempts, attempt, jobs] = rest;
  if (first === 'branches' && rest.length === 1) {
    const repoUrl = `${apiBase}/repos/${repo.fullName}`;
    const branches = repo.branches.flatMap((b) => {
      const head = branchAt(history, b.name, t)?.head;
      return head ? [branchBody(b.name, head, repoUrl)] : [];
    });
    return paged(url, branches, (page) => page);
  }
  if (first === 'compare' && rest.length > 1) {
    const [base = '', head = ''] = rest.slice(1).join('/').split('...');
    const found = compareAt(history, base, head, t);
    return found
      ? json(STATUS.ok, compareBody(repo, base, head, found))
      : notFound();
  }
  if (first !== 'actions' || second !== 'runs') return notFound();
  const runs = repoRuns(world.scenario, world.seed, repo, history).filter(
    (r) => r.createdAt <= t,
  );
  if (rest.length === 2) {
    const newest = [...runs]
      .reverse()
      .map((r) => runBody(repo, r, t, world.at));
    return paged(url, newest, (page) => ({
      total_count: newest.length,
      workflow_runs: page,
    }));
  }
  const run = runs.find((r) => String(r.id) === runId);
  if (
    !run ||
    attempts !== 'attempts' ||
    attempt !== '1' ||
    jobs !== 'jobs' ||
    rest.length !== 6
  )
    return notFound();
  const bodies = jobBodies(repo, run, t, world.at);
  return {
    ...paged(url, bodies, (page) => ({
      total_count: bodies.length,
      jobs: page,
    })),
    delayMs: run.slowJobsMs,
  };
}

/** The scenario token a request's `Authorization` header carries. */
function tokenOf(world: SimWorld, headers: Headers) {
  const secret = /^(?:Bearer|token)\s+(.+)$/i.exec(
    headers.get('authorization') ?? '',
  )?.[1];
  return world.scenario.github.tokens.find((tk) => tk.secret === secret);
}

/** Answer one GitHub request at simulated time `t`; `path` is the URL
 * path below the API base. */
export function githubAnswer(
  world: SimWorld,
  rates: RateBook,
  request: { url: URL; path: string; headers: Headers },
  t: number,
  apiBase: string,
): SimAnswer {
  const token = tokenOf(world, request.headers);
  if (!token || token.rejected)
    return json(
      STATUS.unauthorized,
      githubError('Bad credentials', STATUS.unauthorized),
    );
  const now = world.at(t);
  if (rates.exhausted(token.id, now))
    return json(
      STATUS.forbidden,
      githubError('API rate limit exceeded', STATUS.forbidden),
      rates.charge(token.id, now, true),
    );
  const segments = request.path
    .split('/')
    .filter(Boolean)
    .map(decodeURIComponent);
  const visible = world.scenario.github.repos.filter((r) =>
    token.repos.includes(r.fullName),
  );
  let answer: SimAnswer;
  if (segments.join('/') === 'user/repos') {
    const sorted = [...visible].sort((a, b) =>
      a.fullName.localeCompare(b.fullName),
    );
    answer = paged(
      request.url,
      sorted.map((r) => repoBody(r, apiBase)),
      (page) => page,
    );
  } else if (segments[0] === 'repos' && segments.length > 3) {
    const repo = visible.find(
      (r) => r.fullName === `${segments[1] ?? ''}/${segments[2] ?? ''}`,
    );
    answer = repo
      ? repoRoute(world, repo, segments.slice(3), request.url, t, apiBase)
      : notFound();
  } else answer = notFound();
  if (answer.status === STATUS.ok)
    answer = withEtag(answer, request.headers.get('if-none-match'));
  const rateHeaders = rates.charge(
    token.id,
    now,
    answer.status === STATUS.notModified,
  );
  return { ...answer, headers: { ...answer.headers, ...rateHeaders } };
}
