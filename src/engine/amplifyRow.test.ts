/**
 * Tests for deriving an Amplify row from the cache (spec.md §3.1): its
 * apps' branch lists then each chosen branch's jobs, cells shown as soon
 * as a landed record places them (unsettled until every read lands), no
 * credential means Needs credential, and a failed app read shows on the
 * rows reading that app only (Amplify's NotFoundException as not found);
 * the row is refreshing while an app read has been fetching longer than
 * the delay or is overdue, not while every read is fresh and any fetch
 * quicker (Decisions 46, 47).
 *
 * @module
 */
import { QueryClient } from '@tanstack/query-core';
import { describe, expect, it } from 'vitest';

import { createDemoAmplifyReaderFor } from '@/demo/amplify';
import { DEMO_AMPLIFY_APPS, demoDashboard } from '@/demo/board';
import { cellRulesFor } from '@/domain/config/cellRules';
import { inheritedCredentials } from '@/domain/config/inheritance';
import type { AmplifyRow } from '@/domain/config/row';
import { EMPTY_STATES } from '@/domain/derivation';
import { sourceRuleFor } from '@/domain/model/sources';
import { AmplifyNotFoundError } from '@/lib/amplify/errors';
import { chosenBranches } from '@/lib/amplify/rowJobs';
import { amplifyKey } from '@/query/keys';
import { fetched } from '@/test/fakeReaders';
import { landedAt, markFetching } from '@/test/queryState';

import { type AmplifyContext, deriveAmplifyRow } from './amplifyRow';
import { NOT_FOUND } from './providerOutcome';
import { REFRESHING_DELAY_MS } from './refreshing';

const AWS = 'demo-aws';
const readerFor = createDemoAmplifyReaderFor(() => 0);
const source = sourceRuleFor(demoDashboard, 'amplify');

const rowOf = (id: string): AmplifyRow => {
  const row = demoDashboard.rows.find((r) => r.id === id);
  if (row?.type !== 'amplify') throw new Error(`${id} is not an Amplify row`);
  return row;
};

const ctx = (client: QueryClient, hasReader = true): AmplifyContext => ({
  client,
  stages: demoDashboard.stages,
  rulesFor: (row, stageId) => cellRulesFor(demoDashboard, row, stageId),
  defaultsFor: (row) => inheritedCredentials(demoDashboard, row.id),
  hasReader: () => hasReader,
  source,
  now: 0,
  fetchStartedAt: () => undefined,
});

/** Seed one demo app's branch list and, unless `branchesOnly`, its jobs. */
async function seedApp(
  client: QueryClient,
  region: string,
  appId: string,
  branchesOnly = false,
) {
  const reader = readerFor({ credentialId: AWS, region });
  const branches = await reader.listBranches(appId);
  client.setQueryData(
    amplifyKey(AWS, { call: 'branches', region, appId }),
    fetched(branches),
  );
  if (branchesOnly) return;
  const max = source.reader.jobsPerBranch;
  for (const branch of chosenBranches(branches, source.reader))
    client.setQueryData(
      amplifyKey(AWS, { call: 'jobs', region, appId, branch, max }),
      fetched(await reader.listJobs(appId, branch, max)),
    );
}

const seedRow = async (
  client: QueryClient,
  id: keyof typeof DEMO_AMPLIFY_APPS,
  branchesOnly = false,
) => {
  for (const s of DEMO_AMPLIFY_APPS[id])
    await seedApp(client, s.region, s.appId, branchesOnly);
};

describe('deriveAmplifyRow', () => {
  it('marks cells refreshing while an app read is fetching past the delay or overdue, not while fresh', async () => {
    const client = new QueryClient();
    await seedRow(client, 'marketing-site');
    const row = rowOf('marketing-site');
    const [app] = DEMO_AMPLIFY_APPS['marketing-site'];
    const list = amplifyKey(AWS, { call: 'branches', ...app });
    const landed = landedAt(client, list);
    const at = (now: number, startedAt?: number) =>
      deriveAmplifyRow(
        { ...ctx(client), now, fetchStartedAt: () => startedAt },
        row,
      );
    const marks = (now: number, startedAt?: number) => {
      const cells = Object.values(at(now, startedAt).cells);
      expect(cells.length).toBeGreaterThan(0);
      return cells.map((c) => c?.refreshing === true);
    };
    // Every read of the row polls at its cadence; the jobs landed no
    // earlier than the branch list, so the list goes overdue first.
    const interval = at(landed).needs[0]?.freshness.refetchInterval;
    if (typeof interval !== 'number') throw new Error('the reads never poll');
    expect(marks(landed + interval).some(Boolean)).toBe(false);
    expect(marks(landed + interval + 1).every(Boolean)).toBe(true);
    markFetching(client, list);
    expect(marks(landed, landed - REFRESHING_DELAY_MS).some(Boolean)).toBe(
      false,
    );
    expect(marks(landed, landed - REFRESHING_DELAY_MS - 1).every(Boolean)).toBe(
      true,
    );
  });

  it('shows a cell no stage rule places as empty once its reads landed', async () => {
    const client = new QueryClient();
    const row = rowOf('marketing-site');
    const stageless: AmplifyContext = {
      ...ctx(client),
      rulesFor: (r, stageId) => ({
        ...cellRulesFor(demoDashboard, r, stageId),
        stage: undefined,
      }),
    };
    await seedRow(client, 'marketing-site', true);
    expect(deriveAmplifyRow(stageless, row).cells).toEqual({});
    await seedRow(client, 'marketing-site');
    const out = deriveAmplifyRow(stageless, row);
    expect(Object.keys(out.cells)).toEqual(
      demoDashboard.stages.map((s) => s.id),
    );
    for (const cell of Object.values(out.cells))
      expect(cell).toMatchObject({
        pending: false,
        derivation: { kind: 'empty' },
      });
  });

  it('needs each app branch list first, showing nothing yet', () => {
    const out = deriveAmplifyRow(
      ctx(new QueryClient()),
      rowOf('marketing-site'),
    );
    expect(out.cells).toEqual({});
    expect(out.needs.map((n) => n.key[2].call)).toEqual(['branches']);
  });

  it('needs a jobs query per chosen branch once the list lands', async () => {
    const client = new QueryClient();
    await seedRow(client, 'marketing-site', true);
    const out = deriveAmplifyRow(ctx(client), rowOf('marketing-site'));
    const maxes = out.needs.flatMap(({ key: [, , request] }) =>
      request.call === 'jobs' && 'max' in request ? [request.max] : [],
    );
    expect(maxes.length).toBeGreaterThan(0);
    expect(new Set(maxes)).toEqual(new Set([source.reader.jobsPerBranch]));
  });

  it('derives settled cells once every read lands', async () => {
    const client = new QueryClient();
    await seedRow(client, 'marketing-site');
    const out = deriveAmplifyRow(ctx(client), rowOf('marketing-site'));
    expect(out.cells.prod).toMatchObject({
      pending: false,
      derivation: { kind: 'ok', status: { icon: 'failure' } },
    });
    expect(out.refreshedAt).toBeGreaterThan(0);
  });

  it('shows Needs credential without a secret for its key', () => {
    const out = deriveAmplifyRow(
      ctx(new QueryClient(), false),
      rowOf('marketing-site'),
    );
    expect(out.cells.prod?.derivation).toMatchObject({
      state: EMPTY_STATES.needsCredential,
    });
    expect(out.needs).toEqual([]);
  });

  it('shows a missing app as not found on its own rows only', async () => {
    const client = new QueryClient();
    await seedRow(client, 'marketing-site');
    await seedRow(client, 'partner-portal');
    const site = DEMO_AMPLIFY_APPS['marketing-site'].at(0);
    if (!site) throw new Error('no app');
    await client
      .query({
        queryKey: amplifyKey(AWS, {
          call: 'branches',
          region: site.region,
          appId: site.appId,
        }),
        queryFn: () =>
          Promise.reject(new AmplifyNotFoundError('gone', 'ListBranches')),
        retry: false,
      })
      .catch(() => undefined);
    const broken = deriveAmplifyRow(ctx(client), rowOf('marketing-site'));
    expect(broken.cells.prod?.derivation).toMatchObject({ reason: NOT_FOUND });
    expect(broken.problems).toHaveLength(1);
    const other = deriveAmplifyRow(ctx(client), rowOf('partner-portal'));
    expect(other.cells.prod?.derivation.kind).toBe('ok');
  });
});
