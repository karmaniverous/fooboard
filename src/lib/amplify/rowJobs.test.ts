/**
 * Tests for `chosenBranches` (the branch rule).
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { amplifyBranch } from '@/lib/amplify/sdkShapes';

import { chosenBranches } from './rowJobs';

const glob = (value: string) => ({
  path: '$.branchName',
  operator: 'glob' as const,
  value,
  ignoreCase: true,
  quantifier: 'any' as const,
  not: false,
});

describe('chosenBranches', () => {
  it('keeps the branches the branch rule matches, by name', () => {
    const branches = ['main', 'preview/bali', 'feature/x'].map((branchName) =>
      amplifyBranch({ branchName }),
    );
    expect(
      chosenBranches(branches, {
        branches: { combine: 'or', checks: [glob('main'), glob('preview/*')] },
      }),
    ).toEqual(['main', 'preview/bali']);
  });
});
