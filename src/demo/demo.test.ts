/**
 * Tests that the demo providers drive the real mapping and derivation code
 * to the states the demo promises (spec.md C-23): representative cells for
 * each status, both badges, the empty states, the two failing rows, the
 * multi-source Amplify row, and progress over time.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { cellRulesFor, sourceFor } from '@/domain/config/cellRules';
import { computeStaleness, deriveCell } from '@/domain/derivation';
import { placeCell } from '@/domain/model/cell';
import { amplifyRecord } from '@/domain/statuses/documents';
import { refreshGithubRepo } from '@/engine/githubRow';
import { collectRowJobs } from '@/lib/amplify/rowJobs';
import { GitHubAuthError, GitHubHttpError } from '@/lib/github/errors';
import type { GitHubReader } from '@/lib/github/reader';

import { createDemoAmplifyReaderFor } from './amplify';
import { DEMO_AMPLIFY_APPS, demoDashboard } from './board';
import { createDemoGitHubReader } from './github';
import { stageBranch } from './scenarios';

const rowOf = (id: string) => {
  const row = demoDashboard.rows.find((r) => r.id === id);
  if (!row) throw new Error(`no row ${id}`);
  return row;
};

async function githubCell(reader: GitHubReader, repo: string, stageId: string) {
  const row = rowOf(repo);
  if (row.type !== 'github') throw new Error(`${repo} is not a GitHub row`);
  const result = await refreshGithubRepo(
    {
      rows: [row],
      repoRows: [row],
      stages: demoDashboard.stages,
      rulesFor: (r, s) => cellRulesFor(demoDashboard, r, s),
      source: sourceFor('github'),
      mapping: demoDashboard.mapping,
    },
    reader,
  );
  if (result.kind !== 'refreshed') throw new Error(result.kind);
  return result.rows[repo][stageId].derivation;
}

describe('demo GitHub provider', () => {
  const reader = createDemoGitHubReader(() => 0);

  it.each([
    ['api-core', 'dev', 'success'],
    ['api-core', 'spokane', 'running'],
    ['web-app', 'bali', 'partial'],
    ['web-app', 'texas', 'queued'],
    ['mobile-bff', 'prod', 'failure'],
    ['payments', 'dev', 'cancelled'],
  ])('%s/%s derives %s', async (repo, stageId, icon) => {
    expect(await githubCell(reader, repo, stageId)).toMatchObject({
      kind: 'ok',
      status: { icon },
    });
  });

  it('skips the lint-only run and still derives the dev cell', async () => {
    expect(await githubCell(reader, 'web-app', 'dev')).toMatchObject({
      kind: 'ok',
      status: { icon: 'success' },
    });
  });

  it.each([
    ['auth-service', 'release', 'no-records'],
    ['inventory', 'texas', 'no-records'],
  ])('%s/%s is empty: %s', async (repo, stageId, state) => {
    expect(await githubCell(reader, repo, stageId)).toMatchObject({
      kind: 'empty',
      state,
    });
  });

  it.each([
    ['billing', 'bali', 'dev', { kind: 'behind', count: 3 }],
    ['orders', 'spokane', 'dev', { kind: 'diverged', behind: 4, ahead: 2 }],
    ['api-core', 'bali', 'dev', undefined],
  ])('%s/%s vs its source stage: %o', async (repo, cell, source, badge) => {
    const counts = await reader.compare(
      { owner: 'acme', repo },
      stageBranch(cell),
      stageBranch(source),
    );
    expect(computeStaleness(counts)).toEqual(badge);
  });

  it('fails the two broken rows the way real GitHub would', async () => {
    await expect(
      reader.listWorkflowRuns({ owner: 'acme', repo: 'legacy-billing' }),
    ).rejects.toBeInstanceOf(GitHubAuthError);
    await expect(
      reader.listWorkflowRuns({ owner: 'acme', repo: 'flaky-svc' }),
    ).rejects.toBeInstanceOf(GitHubHttpError);
  });

  it('moves started runs on to success as time passes', async () => {
    let now = 0;
    const live = createDemoGitHubReader(() => now);
    now = 2 * 60_000;
    expect(await githubCell(live, 'api-core', 'spokane')).toMatchObject({
      status: { icon: 'success' },
    });
  });
});

describe('demo Amplify provider', () => {
  const readerFor = createDemoAmplifyReaderFor(() => 0);
  const sourcesOf = (row: keyof typeof DEMO_AMPLIFY_APPS) =>
    DEMO_AMPLIFY_APPS[row].map((s) => ({ credentialId: 'demo-aws', ...s }));

  /** The demo row's cell in `stageId`, from every branch's jobs. */
  async function amplifyCell(
    row: keyof typeof DEMO_AMPLIFY_APPS,
    stageId: string,
  ) {
    const records = (await collectRowJobs(sourcesOf(row), readerFor)).map(
      amplifyRecord,
    );
    const rules = cellRulesFor(demoDashboard, rowOf(row), stageId);
    return deriveCell({
      placed: placeCell(records, rules),
      set: rules.set,
      credentialStatus: 'ok',
    });
  }

  it.each([
    ['marketing-site', 'spokane', 'running'],
    ['marketing-site', 'prod', 'failure'],
  ] as const)('%s/%s derives %s', async (row, stageId, icon) => {
    expect(await amplifyCell(row, stageId)).toMatchObject({
      kind: 'ok',
      status: { icon },
    });
  });

  it('prefers the newer of the partner portal sources', async () => {
    expect(await amplifyCell('partner-portal', 'prod')).toMatchObject({
      kind: 'ok',
      document: { _raw: { source: { appId: 'd1demopartnerus' } } },
    });
  });
});
