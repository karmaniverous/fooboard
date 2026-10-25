/**
 * The simulated GitHub API through the simulator's `fetch` (spec.md §3.14
 * *Request surface*): the repos a token sees, branches, runs (attempt 1)
 * and a run's jobs, and compares, from the world at the request's time,
 * in pages with `Link` headers.
 */
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { MINUTE } from '@/demo/scenarios/pipeline';
import {
  BranchesResponseSchema,
  CompareSchema,
  JobsResponseSchema,
  ReposResponseSchema,
  WorkflowRunsResponseSchema,
} from '@/lib/github/schemas';
import { GITHUB_API_BASE } from '@/lib/transport';
import { bodyOf, rawBody, simHttp } from '@/test/simHttp';
import { TINY_REPO, tinyScenario } from '@/test/simScenario';

const commits = (n: number, branch = 'dev') =>
  Array.from({ length: n }, (_, i) => ({
    kind: 'commit' as const,
    repo: TINY_REPO,
    branch,
    at: -(n - i) * MINUTE,
  }));

const compare = (path: string, github: ReturnType<typeof simHttp>['github']) =>
  github(`/repos/${TINY_REPO}/compare/${path}`).then((res) =>
    bodyOf(res, CompareSchema),
  );

describe('simulated GitHub', () => {
  it('lists the repos the token can see, by name, in pages', async () => {
    const { github } = simHttp();
    const res = await github('/user/repos?per_page=2&page=1');
    expect(res.status).toBe(200);
    const body = await rawBody(res);
    expect(ReposResponseSchema.parse(body).map((r) => r.full_name)).toEqual([
      'acme/app',
      'acme/broken',
    ]);
    expect(body).toMatchObject([
      { private: true, html_url: 'https://github.com/acme/app' },
      {},
    ]);
    const next = `${GITHUB_API_BASE}/user/repos?per_page=2&page=2`;
    expect(res.headers.get('link')).toBe(
      `<${next}>; rel="next", <${next}>; rel="last"`,
    );
    const last = await bodyOf(
      await github('/user/repos?per_page=2&page=2'),
      ReposResponseSchema,
    );
    expect(last.map((r) => r.full_name)).toEqual(['acme/zeta']);
  });

  it("lists a repo's branches with their heads at the time asked", async () => {
    const { github, at } = simHttp(tinyScenario({ pinned: commits(1) }));
    at(-2 * MINUTE);
    const before = await bodyOf(
      await github(`/repos/${TINY_REPO}/branches`),
      BranchesResponseSchema,
    );
    at(0);
    const after = await bodyOf(
      await github(`/repos/${TINY_REPO}/branches?per_page=100&page=1`),
      BranchesResponseSchema,
    );
    expect(after.map((b) => b.name)).toEqual(['dev', 'main']);
    expect(after[0].commit.sha).not.toBe(before[0].commit.sha);
    expect(after[1].commit.sha).toBe(before[1].commit.sha);
  });

  it('lists runs newest first, paged, each at attempt 1', async () => {
    const { github } = simHttp(tinyScenario({ pinned: commits(3) }));
    const res = await github(
      `/repos/${TINY_REPO}/actions/runs?per_page=2&page=1&exclude_pull_requests=true`,
    );
    const body = await rawBody(res);
    expect(WorkflowRunsResponseSchema.parse(body).total_count).toBe(3);
    expect(body).toMatchObject({
      workflow_runs: [
        {
          run_number: 3,
          run_attempt: 1,
          head_branch: 'dev',
          status: 'in_progress',
          created_at: '2026-10-25T11:59:00Z',
        },
        { run_number: 2, run_attempt: 1, head_branch: 'dev' },
      ],
    });
    expect(res.headers.get('link')).toContain('rel="next"');
  });

  it("lists a run's attempt-1 jobs, slowly for a slow run, and 404s other attempts", async () => {
    const waits: number[] = [];
    const s = tinyScenario({
      pinned: [
        {
          kind: 'run',
          repo: TINY_REPO,
          branch: 'main',
          workflow: 'Deploy',
          at: -MINUTE,
          queueMs: 0,
          slowJobsMs: 5000,
        },
      ],
    });
    const { github } = simHttp(s, (ms) => {
      waits.push(ms);
      return Promise.resolve();
    });
    const runs = await bodyOf(
      await github(`/repos/${TINY_REPO}/actions/runs`),
      WorkflowRunsResponseSchema,
    );
    const id = String(runs.workflow_runs[0].id);
    const jobs = await bodyOf(
      await github(
        `/repos/${TINY_REPO}/actions/runs/${id}/attempts/1/jobs?per_page=100&page=1`,
      ),
      JobsResponseSchema,
    );
    expect(jobs.jobs.map((j) => [j.name, j.status])).toEqual([
      ['deploy', 'completed'],
      ['test', 'queued'],
    ]);
    expect(waits).toEqual([5000]);
    for (const path of [
      `runs/${id}/attempts/2/jobs`,
      'runs/1/attempts/1/jobs',
      `runs/${id}/attempts/1/logs`,
      `runs/${id}/attempts/1/jobs/x`,
      'workflows',
    ])
      expect((await github(`/repos/${TINY_REPO}/actions/${path}`)).status).toBe(
        404,
      );
  });

  it('compares two branches both ways, 404 for a missing branch', async () => {
    const hotfix = {
      kind: 'commit' as const,
      repo: TINY_REPO,
      branch: 'main',
      at: -MINUTE / 2,
      message: 'Hotfix',
    };
    const { github } = simHttp(
      tinyScenario({ pinned: [...commits(2), hotfix] }),
    );
    const body = await rawBody(
      await github(`/repos/${TINY_REPO}/compare/main...dev`),
    );
    expect(body).toMatchObject({
      status: 'diverged',
      ahead_by: 2,
      behind_by: 1,
      total_commits: 2,
    });
    expect(CompareSchema.parse(body).commits).toHaveLength(2);
    expect(
      await rawBody(await github(`/repos/${TINY_REPO}/compare/dev...dev`)),
    ).toMatchObject({
      status: 'identical',
      ahead_by: 0,
      behind_by: 0,
    });
    expect(
      await rawBody(await github(`/repos/${TINY_REPO}/compare/dev...main`)),
    ).toMatchObject({ status: 'diverged' });
    expect(
      (await github(`/repos/${TINY_REPO}/compare/main...gone`)).status,
    ).toBe(404);
  });

  it('marks ahead and behind compares', async () => {
    const { github } = simHttp(tinyScenario({ pinned: commits(1) }));
    expect((await compare('main...dev', github)).ahead_by).toBe(1);
    expect(
      await rawBody(await github(`/repos/${TINY_REPO}/compare/main...dev`)),
    ).toMatchObject({ status: 'ahead' });
    expect(
      await rawBody(await github(`/repos/${TINY_REPO}/compare/dev...main`)),
    ).toMatchObject({ status: 'behind' });
  });

  it('keeps the error body shape GitHub sends', async () => {
    const { github } = simHttp();
    const Error = z.object({
      message: z.string(),
      documentation_url: z.string(),
      status: z.string(),
    });
    expect(
      await bodyOf(await github('/repos/acme/nope/branches'), Error),
    ).toEqual({
      message: 'Not Found',
      documentation_url: 'https://docs.github.com/rest',
      status: '404',
    });
  });
});
