/**
 * Tests for the token budgets (spec.md C-16): the tokens a dashboard reads
 * with (each once, inherited ones included), and a target per token that
 * reads `rate_limit` on opening and then at most every `BUDGET_READ_MS`.
 *
 * @module
 */
import { describe, expect, it, vi } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import type { RateLimitBudget } from '@/lib/github';

import { BUDGET_READ_MS, budgetTargets, githubCredentialIds } from './budgets';

const dashboard = DashboardSchema.parse({
  id: 'd',
  name: 'd',
  credentials: [
    { id: 'main', kind: 'github', label: 'main' },
    { id: 'ops', kind: 'github', label: 'ops' },
    { id: 'unused', kind: 'github', label: 'unused' },
  ],
  defaultCredentials: { github: 'main' },
  rows: [
    { type: 'github', id: 'a', repo: 'acme/a', displayName: 'a' },
    {
      type: 'github',
      id: 'b',
      repo: 'acme/b',
      displayName: 'b',
      credentialId: 'ops',
    },
    { type: 'github', id: 'c', repo: 'acme/c', displayName: 'c' },
  ],
  stages: [{ id: 'dev', name: 'dev', rules: branchRules('dev') }],
});

const budget: RateLimitBudget = {
  limit: 5000,
  remaining: 4000,
  reset: 0,
  used: 1000,
  status: 'ok',
};

describe('githubCredentialIds', () => {
  it('lists each token the rows read with once, inherited or their own', () => {
    expect(githubCredentialIds(dashboard)).toEqual(['main', 'ops']);
  });
});

describe('budgetTargets', () => {
  it('reads each token with a reader on opening, then waits BUDGET_READ_MS', async () => {
    let clock = 0;
    const readRateLimit = vi.fn(() => Promise.resolve(budget));
    const onBudget = vi.fn();
    const targets = budgetTargets({
      credentialIds: ['main', 'missing'],
      reader: (id) => (id === 'main' ? { readRateLimit } : undefined),
      onBudget,
      now: () => clock,
    });
    expect(targets.map((t) => t.id)).toEqual(['budget:main']);
    const [target] = targets;
    expect(target.isActive()).toBe(false);
    await target.refresh();
    expect(onBudget).toHaveBeenCalledWith('main', budget);
    clock = BUDGET_READ_MS - 1;
    await target.refresh();
    expect(readRateLimit).toHaveBeenCalledTimes(1);
    clock = BUDGET_READ_MS;
    await target.refresh();
    expect(readRateLimit).toHaveBeenCalledTimes(2);
  });
});
