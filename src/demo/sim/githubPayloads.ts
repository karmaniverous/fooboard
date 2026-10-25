/**
 * GitHub REST bodies for the simulated world (spec.md §3.14 *Request
 * surface*): repos, branches, workflow runs, a run attempt's jobs and
 * compares, shaped as GitHub sends them (the fields the readers parse,
 * and the common ones beside them), with times as GitHub writes them.
 * Pure: the same world and time give the same bodies.
 *
 * @module
 */
import type { Commit } from './history';
import { hash32 } from './random';
import { jobAt, runAt, type SimRun } from './runs';
import type { Repo } from './scenario';

/** GitHub's web host, for `html_url`s. */
const GITHUB_WEB = 'https://github.com';

/** A time as GitHub writes it: ISO 8601 to the second, in UTC. */
const githubTime = (ms: number): string =>
  new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');

/** The repo id GitHub would show, stable for its name. */
const repoId = (fullName: string): number =>
  hash32(`repo:${fullName}`) % 1_000_000_000;

/** A repo as `GET /user/repos` lists it. */
export function repoBody(repo: Repo, apiBase: string): Record<string, unknown> {
  const [owner = '', name = ''] = repo.fullName.split('/');
  return {
    id: repoId(repo.fullName),
    name,
    full_name: repo.fullName,
    private: repo.private,
    owner: { login: owner, type: 'Organization' },
    html_url: `${GITHUB_WEB}/${repo.fullName}`,
    url: `${apiBase}/repos/${repo.fullName}`,
    default_branch: repo.branches[0]?.name ?? 'main',
  };
}

/** A branch as `GET /repos/{repo}/branches` lists it. */
export const branchBody = (
  name: string,
  head: Commit,
  repoUrl: string,
): Record<string, unknown> => ({
  name,
  commit: { sha: head.sha, url: `${repoUrl}/commits/${head.sha}` },
  protected: false,
});

/** A workflow file's path. */
const workflowPath = (run: SimRun): string =>
  run.workflow.path ??
  `.github/workflows/${run.workflow.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.yml`;

/** A run as `GET /repos/{repo}/actions/runs` lists it at `t`; `at`
 * turns simulated time into wall-clock ms. */
export function runBody(
  repo: Repo,
  run: SimRun,
  t: number,
  at: (ms: number) => number,
): Record<string, unknown> {
  const state = runAt(run, t);
  const firstStart = run.jobs[0]?.startAt;
  return {
    id: run.id,
    name: run.workflow.name,
    display_title: run.head.message.split('\n', 1)[0],
    run_number: run.number,
    run_attempt: 1,
    event: run.event,
    status: state.status,
    conclusion: state.conclusion,
    workflow_id: run.workflowId,
    path: workflowPath(run),
    head_branch: run.branch,
    head_sha: run.head.sha,
    head_commit: {
      id: run.head.sha,
      message: run.head.message,
      timestamp: githubTime(at(run.head.at)),
    },
    created_at: githubTime(at(run.createdAt)),
    updated_at: githubTime(at(state.updatedAt)),
    run_started_at: githubTime(at(firstStart ?? run.createdAt)),
    html_url: `${GITHUB_WEB}/${repo.fullName}/actions/runs/${String(run.id)}`,
    repository: { full_name: repo.fullName },
  };
}

/** A run's jobs as `GET …/attempts/1/jobs` lists them at `t`. */
export function jobBodies(
  repo: Repo,
  run: SimRun,
  t: number,
  at: (ms: number) => number,
): Record<string, unknown>[] {
  return run.jobs.map((job) => {
    const state = jobAt(job, t);
    const started = state.status !== 'queued';
    return {
      id: job.id,
      run_id: run.id,
      run_attempt: 1,
      workflow_name: run.workflow.name,
      head_branch: run.branch,
      head_sha: run.head.sha,
      name: job.name,
      status: state.status,
      conclusion: state.conclusion,
      created_at: githubTime(at(run.createdAt)),
      started_at: started ? githubTime(at(job.startAt ?? job.endAt)) : null,
      completed_at:
        state.status === 'completed' ? githubTime(at(job.endAt)) : null,
      html_url: `${GITHUB_WEB}/${repo.fullName}/actions/runs/${String(run.id)}/job/${String(job.id)}`,
    };
  });
}

/** `GET …/compare/{base}...{head}`: `ahead` are the commits `head` has
 * that `base` lacks (oldest first), `behind` the reverse. */
export function compareBody(
  repo: Repo,
  base: string,
  head: string,
  { ahead, behind }: { ahead: Commit[]; behind: Commit[] },
): Record<string, unknown> {
  const status =
    ahead.length > 0 && behind.length > 0
      ? 'diverged'
      : ahead.length > 0
        ? 'ahead'
        : behind.length > 0
          ? 'behind'
          : 'identical';
  return {
    status,
    ahead_by: ahead.length,
    behind_by: behind.length,
    total_commits: ahead.length,
    html_url: `${GITHUB_WEB}/${repo.fullName}/compare/${base}...${head}`,
    commits: ahead.map((c) => ({ sha: c.sha, commit: { message: c.message } })),
  };
}

/** GitHub's error body. */
export const githubError = (
  message: string,
  status: number,
): Record<string, unknown> => ({
  message,
  documentation_url: 'https://docs.github.com/rest',
  status: String(status),
});
