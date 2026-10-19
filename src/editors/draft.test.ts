/**
 * Tests for *Add test* drafts: each unmapped reason leads to its fix, and
 * a run whose repo has no GitHub row offers none.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import type { UnmappedRun } from '@/engine';

import { draftFor, overrideDraftFor } from './draft';

const dashboard = DashboardSchema.parse({
  id: 'd',
  name: 'D',
  rows: [
    {
      type: 'amplify',
      id: 'site',
      repo: 'acme/api',
      displayName: 'site',
      sources: [{ region: 'us-east-1', appId: 'a1' }],
    },
    { type: 'github', id: 'api', repo: 'acme/api', displayName: 'api' },
  ],
});
const run = (
  reason: UnmappedRun['reason'],
  repo = 'acme/api',
): UnmappedRun => ({
  repo,
  runId: 1,
  workflowName: 'Deploy API',
  branch: 'hotfix/1',
  htmlUrl: '',
  reason,
});

describe('draftFor', () => {
  it('maps each reason to its fix', () => {
    expect(draftFor(run({ kind: 'no-row-matches' }), dashboard)).toEqual({
      tab: 'Rows',
      rowId: 'api',
    });
    expect(
      draftFor(
        run({ kind: 'no-stage-matches', branch: 'hotfix/1' }),
        dashboard,
      ),
    ).toEqual({ tab: 'Stages', pattern: 'hotfix/1' });
    expect(draftFor(run({ kind: 'no-item-counts' }), dashboard)).toEqual({
      tab: 'Statuses',
    });
  });

  it("offers an override on the repo's row for an unmatched branch only", () => {
    const branch = run({ kind: 'no-stage-matches', branch: 'hotfix/1' });
    expect(overrideDraftFor(branch, dashboard)).toEqual({
      tab: 'Rows',
      rowId: 'api',
      overrideBranch: 'hotfix/1',
    });
    expect(
      overrideDraftFor(run({ kind: 'no-item-counts' }), dashboard),
    ).toBeUndefined();
  });

  it('offers nothing when no GitHub row reads the repo', () => {
    expect(
      draftFor(run({ kind: 'no-row-matches' }, 'acme/other'), dashboard),
    ).toBeUndefined();
  });
});
