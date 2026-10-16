/**
 * Tests that the demo providers drive the real mapping and derivation code
 * to the states the demo promises (spec.md C-23): representative cells for
 * each status, both badges, the empty states, the two failing rows, the
 * multi-source Amplify row, and progress over time.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import {
  computeStaleness,
  deriveAmplifyCell,
  deriveGithubCell,
} from '@/domain/derivation';
import { collectRowJobs } from '@/lib/amplify/rowJobs';
import { GitHubAuthError, GitHubHttpError } from '@/lib/github/errors';
import { mapRunWithJobs } from '@/lib/github/mapToDerivation';
import type { GitHubReader } from '@/lib/github/reader';

import { createDemoAmplifyReaderFor } from './amplify';
import { DEMO_AMPLIFY_APPS, demoDashboard } from './board';
import { createDemoGitHubReader } from './github';
import { stageBranch } from './scenarios';

const stage = (id: string) => {
  const found = demoDashboard.stages.find((s) => s.id === id);
  if (!found) throw new Error(`no stage ${id}`);
  return found;
};

async function githubCell(reader: GitHubReader, repo: string, stageId: string) {
  const ref = { owner: 'acme', repo };
  const runs = await reader.listWorkflowRuns(ref);
  const withJobs = await Promise.all(
    runs.map(async (run) =>
      mapRunWithJobs(run, await reader.listRunJobs(ref, run.id)),
    ),
  );
  const branches = (await reader.listBranches(ref)).map((b) => b.name);
  return deriveGithubCell({
    runs: withJobs,
    mapping: demoDashboard.mapping,
    branchPattern: stage(stageId).branchPattern,
    rowKeyTests: [],
    branchExists: branches.includes(stageBranch(stageId)),
    credentialStatus: 'ok',
  });
}

describe('demo GitHub provider', () => {
  const reader = createDemoGitHubReader(() => 0);

  it.each([
    ['api-core', 'dev', 'success'],
    ['api-core', 'staging', 'started'],
    ['web-app', 'test', 'partialSuccess'],
    ['web-app', 'preview', 'queued'],
    ['mobile-bff', 'prod', 'failure'],
    ['payments', 'dev', 'cancelled'],
  ])('%s/%s derives %s', async (repo, stageId, status) => {
    expect(await githubCell(reader, repo, stageId)).toMatchObject({
      kind: 'ok',
      status,
    });
  });

  it('skips the lint-only run and still derives the dev cell', async () => {
    expect(await githubCell(reader, 'web-app', 'dev')).toMatchObject({
      kind: 'ok',
      status: 'success',
    });
  });

  it.each([
    ['auth-service', 'release', 'no-branch'],
    ['inventory', 'preview', 'no-recent-runs'],
  ])('%s/%s is empty: %s', async (repo, stageId, state) => {
    expect(await githubCell(reader, repo, stageId)).toMatchObject({
      kind: 'empty',
      state,
    });
  });

  it.each([
    ['billing', 'test', 'dev', { kind: 'behind', count: 3 }],
    ['orders', 'staging', 'test', { kind: 'diverged', behind: 4, ahead: 2 }],
    ['api-core', 'test', 'dev', undefined],
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
    expect(await githubCell(live, 'api-core', 'staging')).toMatchObject({
      status: 'success',
    });
  });
});

describe('demo Amplify provider', () => {
  const readerFor = createDemoAmplifyReaderFor(() => 0);
  const sourcesOf = (row: keyof typeof DEMO_AMPLIFY_APPS) =>
    DEMO_AMPLIFY_APPS[row].map((s) => ({ credentialId: 'demo-aws', ...s }));

  it.each([
    ['marketing-site', 'staging', 'started'],
    ['marketing-site', 'prod', 'failure'],
  ] as const)('%s/%s derives %s', async (row, stageId, status) => {
    const jobs = await collectRowJobs(
      sourcesOf(row),
      stage(stageId).branchPattern,
      readerFor,
    );
    expect(
      deriveAmplifyCell({ ...jobs, credentialStatus: 'ok' }),
    ).toMatchObject({ kind: 'ok', status });
  });

  it('prefers the newer of the partner portal sources', async () => {
    const jobs = await collectRowJobs(
      sourcesOf('partner-portal'),
      'main',
      readerFor,
    );
    expect(
      deriveAmplifyCell({ ...jobs, credentialStatus: 'ok' }),
    ).toMatchObject({ kind: 'ok', appId: 'd1demopartnerus' });
  });
});
