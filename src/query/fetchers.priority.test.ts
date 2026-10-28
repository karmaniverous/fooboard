/**
 * Tests for where the query function queues each request (spec.md §3.2,
 * Decision 45 item 3), at one request in flight: a root read's later
 * polls wait in line behind jobs and compares already queued, while a
 * root read's first load and editor lookups go ahead of them.
 *
 * @module
 */
import { QueryClient } from '@tanstack/query-core';
import { describe, expect, it, vi } from 'vitest';

import type { GitHubApi } from '@/lib/github';
import { fakeGitHubApi, fetched } from '@/test/fakeReaders';
import { WAIT } from '@/test/timeouts';

import { createQueryFn } from './fetchers';
import { passThrough } from './instrument';
import { githubKey } from './keys';
import { createLimiters } from './limiters';
import { createReadWith } from './readWith';

const CREDENTIAL = 'gh';
const BLOCKING_RUN = 1;
const QUEUED_RUN = 2;
const COMPARE = { base: 'main', head: 'dev' };

const runs = (repo: string) =>
  githubKey(CREDENTIAL, { call: 'runs', repo, page: 1 });
const jobs = (runId: number) =>
  githubKey(CREDENTIAL, {
    call: 'jobs',
    repo: 'acme/api',
    runId,
    attempt: 1,
    page: 1,
  });
const compare = githubKey(CREDENTIAL, {
  call: 'compare',
  repo: 'acme/api',
  ...COMPARE,
});
const repos = githubKey(CREDENTIAL, { call: 'repos', page: 1 });

/** A client at one request in flight whose GitHub calls record the order
 * they start in; the blocking run's jobs hold the slot until `release`. */
function setup() {
  const started: string[] = [];
  let release = (): void => undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const api: GitHubApi = fakeGitHubApi({
    runsPage: (ref) => {
      started.push(`runs ${ref.repo}`);
      return Promise.resolve(fetched([]));
    },
    jobsPage: async (_ref, runId) => {
      started.push(`jobs ${String(runId)}`);
      if (runId === BLOCKING_RUN) await held;
      return fetched([]);
    },
    compare: () => {
      started.push('compare');
      return Promise.resolve(
        fetched({ ahead_by: 0, behind_by: 0, html_url: 'u', commits: [] }),
      );
    },
    reposPage: () => {
      started.push('repos');
      return Promise.resolve(fetched([]));
    },
  });
  const limiters = createLimiters();
  limiters.for('github', CREDENTIAL).setMax(1);
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: createQueryFn({
          providers: {
            github: () => api,
            amplify: () => undefined,
            fingerprint: () => 'secret',
          },
          limiters,
          now: Date.now,
          around: () => passThrough,
          readWith: createReadWith(),
        }),
      },
    },
  });
  /** Requests in flight or queued, settled by `drain`. */
  const pending: Promise<unknown>[] = [];
  /** Start a request, to be settled by `drain`. */
  const send = (request: Promise<unknown>) => {
    pending.push(request);
  };
  /** Hold the slot, then queue a run's jobs and a compare behind it. */
  const queueDependents = () => {
    send(client.query({ queryKey: jobs(BLOCKING_RUN) }));
    send(client.query({ queryKey: jobs(QUEUED_RUN) }));
    send(client.query({ queryKey: compare }));
  };
  /** Free the slot, let everything queued run and settle every request. */
  const drain = async () => {
    release();
    await vi.waitFor(() => {
      expect(limiters.for('github', CREDENTIAL).stats()).toMatchObject({
        running: 0,
        queued: 0,
      });
    }, WAIT);
    await Promise.all(pending);
  };
  return { client, started, send, queueDependents, drain };
}

describe('createQueryFn priority', () => {
  it("queues a root read's later poll behind jobs and compares", async () => {
    const { client, started, send, queueDependents, drain } = setup();
    client.setQueryData(runs('acme/api'), fetched([]));
    queueDependents();
    send(client.refetchQueries({ queryKey: runs('acme/api') }));
    await drain();
    expect(started).toEqual(['jobs 1', 'jobs 2', 'compare', 'runs api']);
  });

  it("puts a root read's first load ahead of jobs, compares and polls", async () => {
    const { client, started, send, queueDependents, drain } = setup();
    client.setQueryData(runs('acme/api'), fetched([]));
    queueDependents();
    send(client.refetchQueries({ queryKey: runs('acme/api') }));
    send(client.query({ queryKey: runs('acme/web') }));
    await drain();
    expect(started).toEqual([
      'jobs 1',
      'runs web',
      'jobs 2',
      'compare',
      'runs api',
    ]);
  });

  it('puts an editor lookup ahead of jobs, compares and polls, even cached', async () => {
    const { client, started, send, queueDependents, drain } = setup();
    client.setQueryData(runs('acme/api'), fetched([]));
    client.setQueryData(repos, fetched([]));
    queueDependents();
    send(client.refetchQueries({ queryKey: runs('acme/api') }));
    send(client.refetchQueries({ queryKey: repos }));
    await drain();
    expect(started).toEqual([
      'jobs 1',
      'repos',
      'jobs 2',
      'compare',
      'runs api',
    ]);
  });
});
