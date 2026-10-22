/**
 * Tests for a row's staleness from the cache (spec.md §2.7, §3.1): two
 * compare queries per badged cell keyed by branch pair, polled at the idle
 * interval and versioned by the cells' commits; the badge and compare
 * detail once both land; unsettled while loading; a failed compare
 * unbadges (dropping its data) while a rate limit keeps it.
 *
 * @module
 */
import { QueryClient } from '@tanstack/query-core';
import { describe, expect, it } from 'vitest';

import { StageSchema } from '@/domain/config/stage';
import { GitHubHttpError, RateLimitedError } from '@/lib/github/errors';
import { BUDGET_BACKOFF, IDLE_INTERVAL_MS } from '@/query/intervals';
import { githubKey } from '@/query/keys';
import { fetched } from '@/test/fakeReaders';
import { seedError } from '@/test/githubCache';

import {
  type CellPoint,
  COMMIT_SUBJECTS_LISTED,
  rowStaleness,
} from './staleness';

const REPO = 'acme/api';
const stages = [
  { id: 'dev', name: 'Dev' },
  { id: 'bali', name: 'Bali', sourceStageId: 'dev' },
].map((stage) => StageSchema.parse(stage));
const ok = (branch: string, commit: string): { derivation: CellPoint } => ({
  derivation: { kind: 'ok', branch, commit },
});
const cells = { dev: ok('dev', 'd1'), bali: ok('preview/bali', 'b1') };
const forward = {
  call: 'compare',
  repo: REPO,
  base: 'preview/bali',
  head: 'dev',
} as const;
const reverse = {
  call: 'compare',
  repo: REPO,
  base: 'dev',
  head: 'preview/bali',
} as const;
const commits = (n: number, prefix: string) =>
  Array.from({ length: n }, (_, i) => ({
    sha: String(i),
    commit: { message: `${prefix} ${String(i + 1)}\nbody` },
  }));

function setup(overBudget = false) {
  const client = new QueryClient();
  const link = { client, credentialId: 'demo-github', repo: REPO, overBudget };
  const seed = (
    request: typeof forward | typeof reverse,
    ahead: number,
    behind: number,
    prefix: string,
  ) => {
    client.setQueryData(
      githubKey('demo-github', request),
      fetched({
        ahead_by: ahead,
        behind_by: behind,
        html_url: `u:${prefix}`,
        commits: commits(ahead, prefix),
      }),
    );
  };
  return { client, link, seed };
}

describe('rowStaleness', () => {
  it('needs the forward compare first, versioned by the commits', () => {
    const { link } = setup();
    const { staleness, needs } = rowStaleness(link, stages, cells);
    expect(needs.map((n) => n.key[2])).toEqual([forward]);
    expect(needs[0]).toMatchObject({
      freshness: { refetchInterval: IDLE_INTERVAL_MS },
      version: 'b1|d1',
    });
    expect(staleness.bali).toEqual({ badge: undefined, settled: false });
    expect(staleness.dev).toMatchObject({ settled: true });
  });

  it('reads the reverse compare only when the cell has commits its source lacks', () => {
    const behind = setup();
    behind.seed(forward, 3, 2, 'src');
    const both = rowStaleness(behind.link, stages, cells);
    expect(both.needs.map((n) => n.key[2])).toEqual([forward, reverse]);
    expect(both.staleness.bali).toEqual({ badge: undefined, settled: false });

    const contained = setup();
    contained.seed(forward, 3, 0, 'src');
    const one = rowStaleness(contained.link, stages, cells);
    expect(one.needs.map((n) => n.key[2])).toEqual([forward]);
    expect(one.staleness.bali).toMatchObject({
      settled: true,
      badge: { kind: 'behind', count: 3 },
      compare: { aheadSubjects: [] },
    });
  });

  it('backs off four times over budget', () => {
    const { link } = setup(true);
    const { needs } = rowStaleness(link, stages, cells);
    expect(needs[0]?.freshness.refetchInterval).toBe(
      IDLE_INTERVAL_MS * BUDGET_BACKOFF,
    );
  });

  it('badges once both land, listing the newest subjects each way', () => {
    const { link, seed } = setup();
    seed(forward, 12, 2, 'src');
    seed(reverse, 2, 12, 'own');
    const { staleness } = rowStaleness(link, stages, cells);
    expect(staleness.bali).toMatchObject({
      settled: true,
      badge: { kind: 'diverged', behind: 12, ahead: 2 },
      compare: { sourceBranch: 'dev', htmlUrl: 'u:src' },
    });
    expect(staleness.bali?.compare?.behindSubjects).toHaveLength(
      COMMIT_SUBJECTS_LISTED,
    );
    expect(staleness.bali?.compare?.behindSubjects[0]).toBe('src 12');
    expect(staleness.bali?.compare?.aheadSubjects).toEqual(['own 2', 'own 1']);
  });

  it('unbadges, settled, when a compare fails; a rate limit keeps the data', async () => {
    const failed = setup();
    failed.seed(forward, 1, 0, 'src');
    failed.seed(reverse, 0, 1, 'own');
    await seedError(failed.client, forward, new GitHubHttpError('c', 500));
    expect(rowStaleness(failed.link, stages, cells).staleness.bali).toEqual({
      badge: undefined,
      settled: true,
    });
    const limited = setup();
    limited.seed(forward, 1, 0, 'src');
    limited.seed(reverse, 0, 1, 'own');
    await seedError(limited.client, forward, new RateLimitedError('c', 0));
    expect(
      rowStaleness(limited.link, stages, cells).staleness.bali?.badge,
    ).toEqual({
      kind: 'behind',
      count: 1,
    });
  });

  it('needs nothing without a git link, a source cell or a branch difference', () => {
    const { link } = setup();
    expect(rowStaleness(undefined, stages, cells).needs).toEqual([]);
    expect(rowStaleness(link, stages, { bali: cells.bali }).needs).toEqual([]);
    expect(
      rowStaleness(link, stages, {
        dev: ok('dev', 'd1'),
        bali: ok('dev', 'd2'),
      }).needs,
    ).toEqual([]);
  });
});
