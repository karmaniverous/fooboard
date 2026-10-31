/**
 * Tests for the apps the board reads with each AWS key (spec.md §3.12
 * *IAM*): a key's pins plus the apps its search finds for the board's
 * rows, each once; no entry for a key whose search hasn't finished; and
 * the groups of a found app, deduped by (credential, region, appId), each
 * serving only the cells that read it.
 *
 * @module
 */
import { QueryClient } from '@tanstack/query-core';
import { describe, expect, it } from 'vitest';

import { measureBoard, measureScenario } from '@/demo/scenarios/measure';
import { MEASURE_AWS } from '@/demo/scenarios/measureBoard';
import type { Dashboard } from '@/domain/config/dashboard';
import { createQueryEnv } from '@/query/client';
import { AWS, listedApp, seedSearch } from '@/test/amplifyRows';
import { simProviders, simTransport, withAliases } from '@/test/simDemo';

import { planGroups } from './groups';
import { keyApps } from './keyApps';
import type { DeriveEnv } from './rowDerive';

const MARKETING = { region: 'us-east-1', appId: 'd1demomarketing' };

/** The measurement scenario, `aws2` holding its AWS key too. */
const scenario = withAliases(measureScenario, { aws2: MEASURE_AWS });

function env(): DeriveEnv {
  const query = createQueryEnv({
    providers: (hooks) =>
      simProviders(
        hooks,
        simTransport(() => 0, {}, scenario),
        scenario,
      ),
  });
  return {
    ...query,
    client: new QueryClient(),
    now: () => 0,
    fetchStartedAt: () => undefined,
    boostOf: () => undefined,
  };
}

/** The demo with both Amplify rows found by repo (no pins), the partner
 * portal building the marketing site's repo too. */
const byRepo: Dashboard = {
  ...measureBoard,
  rows: measureBoard.rows.map((r) =>
    r.type === 'amplify'
      ? { ...r, repo: 'acme/marketing-site', pinnedApps: [] }
      : r,
  ),
};

describe('keyApps', () => {
  it('has no entry for a key whose search has not finished', () => {
    expect(keyApps(env(), measureBoard)).toEqual({});
  });

  it("lists a key's pins and the apps its search finds, each once", () => {
    const e = env();
    seedSearch(e.client, AWS, {
      'us-east-1': [listedApp(MARKETING.appId, 'acme/marketing-site')],
    });
    // Pinned: the demo's three pinned apps.
    expect(keyApps(e, measureBoard)[AWS]).toHaveLength(3);
    // Found by repo: both rows find the one app.
    expect(keyApps(e, byRepo)).toEqual({ [AWS]: [MARKETING] });
  });

  it('lists none for a searched key whose rows read no app', () => {
    const e = env();
    seedSearch(e.client, AWS);
    expect(keyApps(e, byRepo)).toEqual({ [AWS]: [] });
  });
});

describe('groups of found apps', () => {
  it('dedupes the reads of an app two rows find into one group', () => {
    const e = env();
    seedSearch(e.client, AWS, {
      'us-east-1': [listedApp(MARKETING.appId, 'acme/marketing-site')],
    });
    const amplify = [...planGroups(e, byRepo).values()].filter(
      (g) => g.kind === 'amplify',
    );
    expect(amplify).toHaveLength(1);
    expect(
      amplify[0]?.readers.map((r) => [r.row.id, r.stageIds.length]),
    ).toEqual([
      ['marketing-site', measureBoard.stages.length],
      ['partner-portal', measureBoard.stages.length],
    ]);
  });

  it('gives each key its own group, serving only the cells reading with it', () => {
    const e = env();
    const [first, ...rest] = measureBoard.stages;
    const twoKeys: Dashboard = {
      ...measureBoard,
      stages: [{ ...first, settings: { awsKey: 'aws2' } }, ...rest],
    };
    const marketing = [...planGroups(e, twoKeys).values()].filter(
      (g) => g.kind === 'amplify' && g.app.appId === MARKETING.appId,
    );
    expect(
      marketing.map((g) => [
        g.kind === 'amplify' ? g.app.credentialId : '',
        g.readers.flatMap((r) => r.stageIds),
      ]),
    ).toEqual([
      ['aws2', [first.id]],
      [AWS, rest.map((s) => s.id)],
    ]);
  });
});
