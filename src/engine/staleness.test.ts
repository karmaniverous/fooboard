/**
 * Tests for `rowStaleness` failure handling: one failed compare unbadges
 * only its cell, and a rate limit stops further compares while keeping the
 * badges already computed.
 *
 * @module
 */
import { describe, expect, it, vi } from 'vitest';

import type { GithubCellResult } from '@/domain/derivation/githubCell';
import { UNKNOWN } from '@/domain/statuses/resolved';
import { type CompareResult, RateLimitedError } from '@/lib/github';

import { rowStaleness } from './staleness';

const stages = [
  { id: 'dev', name: 'Dev', branchPattern: 'dev' },
  { id: 'test', name: 'Test', branchPattern: 'test', sourceStageId: 'dev' },
  { id: 'stg', name: 'Staging', branchPattern: 'stg', sourceStageId: 'test' },
  { id: 'prod', name: 'Prod', branchPattern: 'main', sourceStageId: 'stg' },
];
const cells = Object.fromEntries(
  stages.map((s): [string, GithubCellResult] => [
    s.id,
    {
      kind: 'ok',
      status: UNKNOWN,
      branch: s.branchPattern,
      commit: 'abc',
      time: undefined,
      linkUrl: '',
      document: {
        workflow: 'CI',
        event: 'push',
        branch: s.branchPattern,
        attempt: 1,
        jobs: [],
      },
    },
  ]),
);
const branches = stages.map((s) => ({
  name: s.branchPattern,
  updatedAt: '2026-10-16T00:00:00Z',
}));

const behindByOne: CompareResult = {
  aheadBy: 1,
  behindBy: 0,
  htmlUrl: '',
  aheadCommitSubjects: ['fix'],
  behindCommitSubjects: [],
};

describe('rowStaleness', () => {
  it('unbadges only the cell whose compare fails', async () => {
    const compare = vi.fn((base: string) =>
      base === 'stg'
        ? Promise.reject(new Error('boom'))
        : Promise.resolve(behindByOne),
    );
    const result = await rowStaleness(stages, cells, branches, compare);
    expect(result.test.badge).toEqual({ kind: 'behind', count: 1 });
    expect(result.stg.badge).toBeUndefined();
    expect(result.prod.badge).toEqual({ kind: 'behind', count: 1 });
  });

  it('stops comparing once rate limited, keeping earlier badges', async () => {
    const compare = vi.fn((base: string) =>
      base === 'stg'
        ? Promise.reject(new RateLimitedError('compare', 0))
        : Promise.resolve(behindByOne),
    );
    const result = await rowStaleness(stages, cells, branches, compare);
    expect(result.test.badge).toEqual({ kind: 'behind', count: 1 });
    expect(compare).toHaveBeenCalledTimes(2);
  });
});
