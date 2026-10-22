/**
 * Tests for a GitHub row's provider failures (spec.md §3.1, §3.3): a
 * failed jobs read shows on its cell; a root failure shows the matching
 * empty state whatever is cached (expired token, not found, other errors),
 * a 404 is a row problem that can't be dismissed, a rate limit keeps the
 * cached data, and a renamed repo is flagged while its data stays.
 *
 * @module
 */
import { QueryClient } from '@tanstack/query-core';
import { describe, expect, it } from 'vitest';

import { EMPTY_STATES } from '@/domain/derivation';
import {
  GitHubAuthError,
  GitHubHttpError,
  GitHubNotFoundError,
  RateLimitedError,
} from '@/lib/github/errors';
import {
  DEMO_TOKEN,
  demoContext,
  demoGithubRow,
  demoRuns,
  jobsRequest,
  seedDemoRepo,
  seedError,
  seedRuns,
} from '@/test/githubCache';

import { deriveGithubRow } from './githubRow';
import { NOT_FOUND } from './providerOutcome';

const REPO = 'acme/api-core';
const row = demoGithubRow('api-core');
const runsKey = (page = 1) =>
  JSON.stringify(['github', DEMO_TOKEN, { call: 'runs', repo: REPO, page }]);
const keyOf = (n: { key: unknown }) => JSON.stringify(n.key);

describe('deriveGithubRow failures', () => {
  it('shows a failed jobs read on the cell, dropping its cached jobs', async () => {
    const client = new QueryClient();
    const runs = await seedDemoRepo(client, REPO);
    const dev = runs.find((r) => r.head_branch === 'dev');
    if (!dev) throw new Error('no dev run');
    await seedError(
      client,
      jobsRequest(REPO, dev),
      new GitHubHttpError('jobs', 502),
    );
    const out = deriveGithubRow(demoContext(client, REPO), row);
    expect(out.cells.dev?.derivation).toMatchObject({
      kind: 'empty',
      state: EMPTY_STATES.error,
    });
    expect(out.problems.some((p) => p.message.includes('502'))).toBe(true);
  });

  it.each([
    [
      '401 shows Needs credential',
      new GitHubAuthError('runs'),
      EMPTY_STATES.needsCredential,
      false,
    ],
    [
      '404 shows not found',
      new GitHubNotFoundError('runs'),
      EMPTY_STATES.error,
      true,
    ],
    [
      'a 5xx shows the error',
      new GitHubHttpError('runs', 500),
      EMPTY_STATES.error,
      true,
    ],
  ])('%s, whatever is cached', async (_label, error, state, problem) => {
    const client = new QueryClient();
    await seedDemoRepo(client, REPO);
    await seedError(client, { call: 'runs', repo: REPO, page: 1 }, error);
    const out = deriveGithubRow(demoContext(client, REPO), row);
    expect(out.cells.dev?.derivation).toMatchObject({ kind: 'empty', state });
    expect(out.problems.length > 0).toBe(problem);
    // The runs query is still observed, so the row recovers.
    expect(out.needs.map(keyOf)).toContain(runsKey());
  });

  it('marks a 404 not found, on the row, not dismissable', async () => {
    const client = new QueryClient();
    await seedDemoRepo(client, REPO);
    await seedError(
      client,
      { call: 'runs', repo: REPO, page: 1 },
      new GitHubNotFoundError('runs'),
    );
    const out = deriveGithubRow(demoContext(client, REPO), row);
    expect(out.cells.dev?.derivation).toMatchObject({ reason: NOT_FOUND });
    expect(out.problems[0]).toMatchObject({
      dismissable: false,
      target: { kind: 'row', id: row.id },
    });
  });

  it('keeps the cached data through a rate limit', async () => {
    const client = new QueryClient();
    await seedDemoRepo(client, REPO);
    await seedError(
      client,
      { call: 'runs', repo: REPO, page: 1 },
      new RateLimitedError('runs', 0),
    );
    const out = deriveGithubRow(demoContext(client, REPO), row);
    expect(out.cells.dev?.derivation.kind).toBe('ok');
  });

  it('flags a renamed repo, keeping its data', async () => {
    const client = new QueryClient();
    const runs = (await demoRuns(REPO)).map((r) => ({
      ...r,
      repository: { full_name: 'acme/api-core-v2' },
    }));
    seedRuns(client, REPO, runs);
    const out = deriveGithubRow(demoContext(client, REPO), row);
    expect(out.cells.dev?.derivation.kind).toBe('ok');
    const renamed = out.problems.find((p) =>
      p.message.includes('renamed to acme/api-core-v2'),
    );
    expect(renamed?.target).toEqual({ kind: 'row', id: row.id });
    const moved = new QueryClient();
    seedRuns(moved, REPO, [], { redirected: true });
    expect(
      deriveGithubRow(demoContext(moved, REPO), row).problems,
    ).toHaveLength(1);
  });
});
