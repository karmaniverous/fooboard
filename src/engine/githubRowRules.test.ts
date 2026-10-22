/**
 * Tests for how a GitHub row's rules steer its derivation (spec.md
 * §3.1, Decision 37): a cell with no stage rule shows at once and asks
 * for no jobs; a cell whose rules test items waits for its jobs (no
 * provisional look); a `keep` rule that tests items is judged on the full
 * record; a run's jobs spread over pages count once every page landed;
 * an old run without an attempt number reads attempt 1.
 *
 * @module
 */
import { QueryClient } from '@tanstack/query-core';
import { omit } from 'radash';
import { describe, expect, it } from 'vitest';

import { all, exists, is } from '@/domain/model/ruleBuilders';
import { githubKey } from '@/query/keys';
import { fetched } from '@/test/fakeReaders';
import {
  DEMO_TOKEN,
  demoContext,
  demoGithubRow,
  demoJobs,
  demoRuns,
  jobsRequest,
  seedDemoRepo,
  seedJobs,
  seedRuns,
} from '@/test/githubCache';

import { deriveGithubRow } from './githubRow';
import type { Need } from './need';

const REPO = 'acme/api-core';
const row = demoGithubRow('api-core');

const jobsNeeds = (needs: Need[]) =>
  needs.flatMap((need) =>
    need.key[0] === 'github' && need.key[2].call === 'jobs'
      ? [need.key[2]]
      : [],
  );

describe('deriveGithubRow rules', () => {
  it('shows a cell with no stage rule at once, asking for no jobs', async () => {
    const client = new QueryClient();
    seedRuns(client, REPO, await demoRuns(REPO));
    const base = demoContext(client, REPO);
    const ctx = demoContext(client, REPO, {
      rulesFor: (r, stageId) => ({
        ...base.rulesFor(r, stageId),
        stage: undefined,
      }),
    });
    const out = deriveGithubRow(ctx, row);
    expect(Object.keys(out.cells)).toEqual(ctx.stages.map((s) => s.id));
    for (const cell of Object.values(out.cells)) {
      expect(cell?.pending).toBeFalsy();
      expect(cell?.provisional).toBeUndefined();
    }
    expect(jobsNeeds(out.needs)).toEqual([]);
  });

  it('keeps a cell whose rules test items a skeleton until its jobs land', async () => {
    const client = new QueryClient();
    const base = demoContext(client, REPO);
    const ctx = demoContext(client, REPO, {
      rulesFor: (r, stageId) => {
        const rules = base.rulesFor(r, stageId);
        return {
          ...rules,
          record: all(...rules.record.checks, exists('$.items')),
        };
      },
    });
    seedRuns(client, REPO, await demoRuns(REPO));
    const shallow = deriveGithubRow(ctx, row);
    expect(shallow.cells.dev).toBeUndefined();
    expect(jobsNeeds(shallow.needs).length).toBeGreaterThan(0);
    await seedDemoRepo(client, REPO);
    expect(deriveGithubRow(ctx, row).cells.dev).toMatchObject({
      pending: false,
      derivation: { kind: 'ok' },
    });
  });

  it('judges a keep rule that tests items on the full record', async () => {
    const client = new QueryClient();
    await seedDemoRepo(client, REPO);
    const base = demoContext(client, REPO);
    const keepNone = demoContext(client, REPO, {
      source: { ...base.source, keep: all(is('$.items[0].name', 'no-such')) },
    });
    expect(deriveGithubRow(base, row).cells.dev?.derivation.kind).toBe('ok');
    expect(deriveGithubRow(keepNone, row).cells.dev).toMatchObject({
      pending: false,
      derivation: { kind: 'empty' },
    });
  });

  it('counts a run whose jobs span pages once every page landed', async () => {
    const whole = new QueryClient();
    await seedDemoRepo(whole, REPO);
    const expected = deriveGithubRow(demoContext(whole, REPO), row).cells.dev;

    const client = new QueryClient();
    const runs = await demoRuns(REPO);
    seedRuns(client, REPO, runs);
    for (const run of runs) {
      const jobs = await demoJobs(REPO, run.id);
      if (jobs.length < 2) {
        seedJobs(client, REPO, run, jobs);
        continue;
      }
      const half = Math.ceil(jobs.length / 2);
      const request = jobsRequest(REPO, run);
      client.setQueryData(
        githubKey(DEMO_TOKEN, request),
        fetched(jobs.slice(0, half), { hasNext: true }),
      );
      client.setQueryData(
        githubKey(DEMO_TOKEN, { ...request, page: 2 }),
        fetched(jobs.slice(half)),
      );
    }
    const out = deriveGithubRow(demoContext(client, REPO), row);
    expect(out.cells.dev?.derivation).toEqual(expected?.derivation);
    expect(jobsNeeds(out.needs).some((r) => r.page === 2)).toBe(true);
  });

  it('reads attempt 1 of a run that gives no attempt number', async () => {
    const client = new QueryClient();
    const runs = (await demoRuns(REPO)).map((run) =>
      omit(run, ['run_attempt']),
    );
    seedRuns(client, REPO, runs);
    const out = deriveGithubRow(demoContext(client, REPO), row);
    const attempts = jobsNeeds(out.needs).map((r) => r.attempt);
    expect(attempts.length).toBeGreaterThan(0);
    expect(attempts.every((a) => a === 1)).toBe(true);
  });
});
