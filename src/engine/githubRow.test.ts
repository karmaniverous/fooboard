/**
 * Tests for refreshing a GitHub repo's cells (spec.md §4.3.2): a cell's
 * run is the newest candidate with a relevant job anywhere in the fetched
 * window, however many newer runs have none.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { demoDashboard } from '@/demo/board';
import { createDemoGitHubReader } from '@/demo/github';
import { cellRulesFor, sourceFor } from '@/domain/config/cellRules';
import type { GitHubReader } from '@/lib/github/reader';

import { refreshGithubRepo } from './githubRow';

describe('refreshGithubRepo', () => {
  it('looks past many newer runs without a relevant job', async () => {
    const demo = createDemoGitHubReader(() => 0);
    const LINT_RUNS = 12;
    const reader: GitHubReader = {
      ...demo,
      listWorkflowRuns: async (ref, options) => {
        const runs = await demo.listWorkflowRuns(ref, options);
        const dev = runs.find((r) => r.head_branch === 'dev');
        if (!dev) throw new Error('no dev run in the demo');
        const lint = Array.from({ length: LINT_RUNS }, (_, i) => ({
          ...dev,
          id: 50_000 + i,
          name: 'Lint',
          created_at: new Date(
            Date.parse(dev.created_at) + (i + 1) * 1000,
          ).toISOString(),
        }));
        return [...lint.reverse(), ...runs];
      },
      listRunJobs: async (ref, runId, options) => {
        if (runId < 50_000) return demo.listRunJobs(ref, runId, options);
        const [template] = await demo.listRunJobs(ref, 1000, options);
        return [{ ...template, id: runId * 10, run_id: runId, name: 'lint' }];
      },
    };
    const row = demoDashboard.rows.find((r) => r.id === 'api-core');
    if (row?.type !== 'github') throw new Error('api-core is not a GitHub row');
    const result = await refreshGithubRepo(
      {
        rows: [row],
        repoRows: [row],
        stages: demoDashboard.stages,
        rulesFor: (r, stageId) => cellRulesFor(demoDashboard, r, stageId),
        source: sourceFor('github'),
        mapping: demoDashboard.mapping,
      },
      reader,
    );
    if (result.kind !== 'refreshed') throw new Error(result.kind);
    expect(result.rows['api-core'].dev.derivation).toMatchObject({
      kind: 'ok',
      status: { icon: 'success' },
    });
  });
});
