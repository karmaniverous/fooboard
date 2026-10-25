/**
 * The simulator's transport (spec.md §3.14, Decision 53): it answers
 * GitHub's API base and Amplify's regional endpoints, and fails every
 * other request as a network error; its latency and a slow run's jobs
 * delay responses, an abort meanwhile rejecting as `fetch` does; the
 * same scenario, seed and time give byte-identical answers, ETags
 * included, and another seed another world.
 */
import { describe, expect, it } from 'vitest';

import { acmeScenario } from '@/demo/scenarios/acme';
import { MINUTE } from '@/demo/scenarios/pipeline';
import { WorkflowRunsResponseSchema } from '@/lib/github/schemas';
import { GITHUB_API_BASE } from '@/lib/transport';
import { bodyOf } from '@/test/simHttp';
import { TINY_REPO, TINY_TOKEN, tinyScenario } from '@/test/simScenario';

import { createSimulator, type Wait } from './simulator';

const EPOCH = Date.UTC(2026, 9, 25, 12);
const auth = { headers: { authorization: `Bearer ${TINY_TOKEN}` } };

describe('simulator transport', () => {
  it('fails every request it does not simulate as a network error', async () => {
    const { fetch, githubApiBase } = createSimulator(tinyScenario(), {
      clock: () => EPOCH,
    });
    expect(githubApiBase).toBe(GITHUB_API_BASE);
    for (const url of [
      'https://example.com/',
      'https://github.com/acme/app',
      'http://amplify.us-east-1.amazonaws.com/apps',
      'https://amplify.mars-west-1.amazonaws.com/apps',
      'https://sts.amazonaws.com/',
      'http://api.github.com/user/repos',
    ])
      await expect(fetch(url, auth)).rejects.toThrow(TypeError);
    await expect(
      fetch(`${GITHUB_API_BASE}/user/repos`, {
        ...auth,
        method: 'POST',
        body: '{}',
      }),
    ).rejects.toThrow('Failed to fetch');
    expect((await fetch(`${GITHUB_API_BASE}/user/repos`, auth)).status).toBe(
      200,
    );
  });

  it('delays responses by its latency plus a slow run, and honours aborts', async () => {
    const waits: number[] = [];
    const wait: Wait = (ms) => {
      waits.push(ms);
      return Promise.resolve();
    };
    const s = tinyScenario({
      pinned: [
        {
          kind: 'run',
          repo: TINY_REPO,
          branch: 'main',
          workflow: 'Deploy',
          at: -MINUTE,
          slowJobsMs: 5000,
        },
      ],
    });
    const sim = createSimulator(s, {
      clock: () => EPOCH,
      latencyMs: 300,
      wait,
    });
    const runs = await bodyOf(
      await sim.fetch(
        `${GITHUB_API_BASE}/repos/${TINY_REPO}/actions/runs`,
        auth,
      ),
      WorkflowRunsResponseSchema,
    );
    await sim.fetch(
      `${GITHUB_API_BASE}/repos/${TINY_REPO}/actions/runs/${String(runs.workflow_runs[0].id)}/attempts/1/jobs`,
      auth,
    );
    expect(waits).toEqual([300, 5300]);
    // Aborted before it is sent, or while it waits.
    const aborted = new AbortController();
    aborted.abort();
    await expect(
      sim.fetch(`${GITHUB_API_BASE}/user/repos`, {
        ...auth,
        signal: aborted.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    const slow = createSimulator(s, { clock: () => EPOCH, latencyMs: 60_000 });
    const later = new AbortController();
    const pending = slow.fetch(`${GITHUB_API_BASE}/user/repos`, {
      ...auth,
      signal: later.signal,
    });
    later.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    const instant = createSimulator(s, { clock: () => EPOCH, latencyMs: 1 });
    expect(
      (await instant.fetch(`${GITHUB_API_BASE}/user/repos`, auth)).status,
    ).toBe(200);
  });

  it('a wait that ignores the abort still rejects once it ends', async () => {
    const controller = new AbortController();
    const sim = createSimulator(tinyScenario(), {
      clock: () => EPOCH,
      latencyMs: 10,
      wait: () => {
        controller.abort();
        return Promise.resolve();
      },
    });
    await expect(
      sim.fetch(`${GITHUB_API_BASE}/user/repos`, {
        ...auth,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('gives byte-identical answers for the same scenario, seed and time', async () => {
    const page = async (seed?: number) => {
      const sim = createSimulator(acmeScenario, {
        clock: () => EPOCH,
        ...(seed === undefined ? {} : { seed }),
      });
      const res = await sim.fetch(
        `${GITHUB_API_BASE}/repos/acme/cart/actions/runs?per_page=100&page=1`,
        {
          headers: { authorization: 'Bearer demo-token-acme' },
        },
      );
      return { etag: res.headers.get('etag'), body: await res.text() };
    };
    const first = await page();
    expect(await page()).toEqual(first);
    expect((await page(1)).body).not.toBe(first.body);
  });

  it('reads the world at the clock time of each request', async () => {
    let now = EPOCH;
    const s = tinyScenario({
      pinned: [{ kind: 'commit', repo: TINY_REPO, branch: 'dev', at: MINUTE }],
    });
    const sim = createSimulator(s, { clock: () => now });
    const count = async () =>
      (
        await bodyOf(
          await sim.fetch(
            `${GITHUB_API_BASE}/repos/${TINY_REPO}/actions/runs`,
            auth,
          ),
          WorkflowRunsResponseSchema,
        )
      ).total_count;
    expect(await count()).toBe(0);
    now = EPOCH + MINUTE;
    expect(await count()).toBe(1);
  });
});
