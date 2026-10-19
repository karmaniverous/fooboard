/**
 * Tests for `rowStaleness` failure handling: one failed compare unbadges
 * only its cell, and a rate limit stops further compares while keeping the
 * badges already computed.
 *
 * @module
 */
import { describe, expect, it, vi } from 'vitest';

import { branchRules } from '@/domain/config/placement';
import type { CellResult } from '@/domain/derivation/cell';
import { UNKNOWN } from '@/domain/statuses/resolved';
import { type CompareResult, RateLimitedError } from '@/lib/github';

import { rowStaleness } from './staleness';

const STAGES = [
  ['dev', 'Dev', 'dev'],
  ['test', 'Test', 'test', 'dev'],
  ['stg', 'Staging', 'stg', 'test'],
  ['prod', 'Prod', 'main', 'stg'],
] as const;
const stages = STAGES.map(([id, name, branch, sourceStageId]) => ({
  id,
  name,
  rules: branchRules(branch),
  sourceStageId,
  branch,
}));
const cells = Object.fromEntries(
  stages.map((s): [string, CellResult] => [
    s.id,
    {
      kind: 'ok',
      status: UNKNOWN,
      branch: s.branch,
      commit: 'abc',
      time: undefined,
      linkUrl: '',
      document: { workflow: 'CI', branch: s.branch, items: [] },
    },
  ]),
);

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
    const result = await rowStaleness(stages, cells, compare);
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
    const result = await rowStaleness(stages, cells, compare);
    expect(result.test.badge).toEqual({ kind: 'behind', count: 1 });
    expect(compare).toHaveBeenCalledTimes(2);
  });
});
