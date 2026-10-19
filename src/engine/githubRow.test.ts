/**
 * Tests for refreshing a GitHub repo's cells (spec.md A§4.3.7): a cell's
 * record is the newest with a counted item anywhere in what was read,
 * however many newer runs have none; the source rule's keep rule drops
 * records (judged on items when it tests them); reports whether the read
 * came back full.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { demoDashboard } from '@/demo/board';
import { createDemoGitHubReader } from '@/demo/github';
import { cellRulesFor } from '@/domain/config/cellRules';
import { all, exists, is, not } from '@/domain/model/ruleBuilders';
import type { SourceRuleOf } from '@/domain/model/sourceRule';
import { sourceRuleFor } from '@/domain/model/sources';
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
        source: sourceRuleFor(demoDashboard, 'github'),
      },
      reader,
    );
    if (result.kind !== 'refreshed') throw new Error(result.kind);
    expect(result.rows['api-core'].dev.derivation).toMatchObject({
      kind: 'ok',
      status: { icon: 'success' },
    });
  });

  const row = demoDashboard.rows.find((r) => r.id === 'api-core');
  const refresh = async (
    source: SourceRuleOf<'github'>,
    reader: GitHubReader,
  ) => {
    if (row?.type !== 'github') throw new Error('api-core is not a GitHub row');
    const result = await refreshGithubRepo(
      {
        rows: [row],
        repoRows: [row],
        stages: demoDashboard.stages,
        rulesFor: (r, stageId) => cellRulesFor(demoDashboard, r, stageId),
        source,
      },
      reader,
    );
    if (result.kind !== 'refreshed') throw new Error(result.kind);
    return result;
  };

  it('drops records the keep rule rejects, on record keys or items', async () => {
    const reader = createDemoGitHubReader(() => 0);
    const builtin = sourceRuleFor(demoDashboard, 'github');
    const plain = await refresh(builtin, reader);
    expect(plain.rows['api-core'].dev.derivation.kind).toBe('ok');
    const noDev = await refresh(
      { ...builtin, keep: all(not(is('$.branch', 'dev'))) },
      reader,
    );
    expect(noDev.rows['api-core'].dev.derivation).toMatchObject({
      kind: 'empty',
      state: 'no-records',
    });
    const noItems = await refresh(
      { ...builtin, keep: all(exists("$.items[?@.name == 'nothing']")) },
      reader,
    );
    expect(noItems.rows['api-core'].dev.derivation).toMatchObject({
      kind: 'empty',
      state: 'no-records',
    });
    expect(plain.full).toBe(false);
  });

  it('reports a full read when the reader returns as many runs as the rule reads', async () => {
    const demo = createDemoGitHubReader(() => 0);
    const builtin = sourceRuleFor(demoDashboard, 'github');
    const runs = (
      await demo.listWorkflowRuns({ owner: 'acme', repo: 'api-core' })
    ).length;
    const result = await refresh(
      { ...builtin, reader: { ...builtin.reader, runs } },
      demo,
    );
    expect(result.full).toBe(true);
  });
});
