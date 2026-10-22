/**
 * Tests for the per-credential limiters (spec.md §3.1, Decision 28): one
 * limiter per credential and provider, created at the dashboard's
 * *requests in flight* for its kind (10 until configured), and a changed
 * setting applied at once to limiters already running.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { DEFAULT_REQUESTS_IN_FLIGHT } from '@/domain/config/settings';

import { createLimiters } from './limiters';

const board = (github: number, aws: number) =>
  DashboardSchema.parse({
    id: 'd',
    name: 'D',
    credentials: [
      { id: 'gh', kind: 'github', label: 'token' },
      { id: 'key', kind: 'aws', label: 'key' },
    ],
    settings: { requestsInFlight: { github, aws } },
  });

describe('createLimiters', () => {
  it('keeps one limiter per credential and provider', () => {
    const limiters = createLimiters();
    expect(limiters.for('github', 'gh')).toBe(limiters.for('github', 'gh'));
    expect(limiters.for('github', 'gh')).not.toBe(limiters.for('github', 'x'));
    expect(limiters.for('github', 'gh')).not.toBe(
      limiters.for('amplify', 'gh'),
    );
  });

  it('starts at the default until configured, then at each kind’s cap', () => {
    const limiters = createLimiters();
    expect(limiters.for('github', 'early').stats().max).toBe(
      DEFAULT_REQUESTS_IN_FLIGHT,
    );
    limiters.configure(board(3, 7));
    expect(limiters.for('github', 'gh').stats().max).toBe(3);
    expect(limiters.for('amplify', 'key').stats().max).toBe(7);
  });

  it('applies a changed cap at once to a running limiter', () => {
    const limiters = createLimiters();
    const limiter = limiters.for('github', 'gh');
    limiters.configure(board(4, 10));
    expect(limiter.stats().max).toBe(4);
    limiters.configure(board(20, 10));
    expect(limiter.stats().max).toBe(20);
  });
});
