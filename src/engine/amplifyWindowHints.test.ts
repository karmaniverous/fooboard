/**
 * Tests for an Amplify app's window hints judged per branch (spec 0.2.0
 * §3.B; Decision 94, #36): a *No records* cell whose stage rule is a
 * branch pattern is hinted only when the read of some branch its pattern
 * matches came back full itself, while a cell whose rule isn't exactly a
 * branch pattern, a cell with no Amplify stage rule and every cell under a
 * custom Amplify source rule keep the app-wide judgement; and `appState`
 * records each branch's own read beside the app-wide flag.
 *
 * @module
 */
import { QueryClient } from '@tanstack/query-core';
import { describe, expect, it } from 'vitest';

import { measureBoard, measureScenario } from '@/demo/scenarios/measure';
import { MEASURE_AMPLIFY_APPS } from '@/demo/scenarios/measureBoard';
import type { Dashboard } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import { EMPTY_STATES } from '@/domain/derivation';
import { sourceRuleFor } from '@/domain/model/sources';
import { branchRule } from '@/domain/rules/branch';
import { customiseSource } from '@/editors/sources/customSource';
import { amplifyBranch, amplifyJobSummary } from '@/lib/amplify/sdkShapes';
import { createQueryEnv } from '@/query/client';
import { amplifyKey } from '@/query/keys';
import { AWS } from '@/test/amplifyRows';
import { fetched } from '@/test/fakeReaders';
import { simProviders, simTransport } from '@/test/simDemo';

import { appState } from './amplifyApp';
import { computeGroup, planGroups } from './groups';
import type { DeriveEnv, RowEntry } from './rowDerive';

const [APP] = MEASURE_AMPLIFY_APPS['marketing-site'];
const ROW = 'marketing-site';
const MAX = sourceRuleFor(measureBoard, 'amplify').reader.jobsPerBranch;

/** The app's branches: how many jobs each one's read returns. `main` and
 * `preview/bali` come back full; the rest don't. */
const JOBS: Record<string, number> = {
  main: MAX,
  dev: 1,
  'preview/bali': MAX,
  'preview/spokane': 1,
};

function seededEnv(): DeriveEnv {
  const client = new QueryClient();
  const { region, appId } = APP;
  client.setQueryData(
    amplifyKey(AWS, { call: 'branches', region, appId }),
    fetched(
      Object.keys(JOBS).map((branchName) => amplifyBranch({ branchName })),
    ),
  );
  for (const [branch, count] of Object.entries(JOBS))
    client.setQueryData(
      amplifyKey(AWS, { call: 'jobs', region, appId, branch, max: MAX }),
      fetched(
        Array.from({ length: count }, (_, i) =>
          amplifyJobSummary({ jobId: String(i + 1), status: 'SUCCEED' }),
        ),
      ),
    );
  const query = createQueryEnv({
    providers: (hooks) =>
      simProviders(
        hooks,
        simTransport(() => 0),
        measureScenario,
      ),
  });
  return { ...query, client, now: () => 0, fetchStartedAt: () => undefined };
}

/** The marketing site's row with every cell showing *No records*, so
 * only the read's fullness decides the hints. */
const emptyRow = (dashboard: Dashboard): RowEntry => ({
  cells: [],
  needs: [],
  groups: [],
  derivation: {
    needs: [],
    problems: [],
    cells: Object.fromEntries(
      dashboard.stages.map((s) => [
        s.id,
        {
          derivation: { kind: 'empty', state: EMPTY_STATES.noRecords },
          active: false,
          pending: false,
        },
      ]),
    ),
  },
});

/** The stages of the marketing site's row that get a window hint. */
function hintedStages(dashboard: Dashboard): string[] {
  const env = seededEnv();
  const rows = new Map([[ROW, emptyRow(dashboard)]]);
  return [...planGroups(env, dashboard).values()]
    .filter((plan) => plan.kind === 'amplify' && plan.app.appId === APP.appId)
    .flatMap((plan) => computeGroup(env, dashboard, plan, rows).problems)
    .flatMap((p) =>
      p.target?.kind === 'source' && p.level.kind === 'cell'
        ? [p.level.stageId]
        : [],
    );
}

/** The demo board with the given stages' rules replaced. */
const withStageRules = (
  rules: Record<string, Dashboard['stages'][number]['rules']>,
): Dashboard => ({
  ...measureBoard,
  stages: measureBoard.stages.map((s) =>
    s.id in rules ? { ...s, rules: rules[s.id] ?? s.rules } : s,
  ),
});

describe('appState', () => {
  it("records each branch's own read beside the app-wide flag", () => {
    const env = seededEnv();
    const state = appState(
      env.client,
      { credentialId: AWS, ...APP },
      sourceRuleFor(measureBoard, 'amplify'),
    );
    expect(state.full).toBe(true);
    expect(state.readBranches).toEqual(
      Object.entries(JOBS).map(([name, count]) => ({
        name,
        full: count >= MAX,
      })),
    );
  });
});

describe('Amplify window hints, per branch', () => {
  it('hints a cell matching a branch whose own read came back full', () => {
    expect(hintedStages(measureBoard)).toContain('prod');
  });

  it('gives none to a cell matching only a branch read short, while another branch was full', () => {
    expect(hintedStages(measureBoard)).not.toContain('dev');
  });

  it('gives none to a cell whose pattern matches no branch the read covers', () => {
    // Texas's preview/texas isn't one of the app's branches.
    expect(hintedStages(measureBoard)).not.toContain('texas');
  });

  it('hints a cell whose pattern matches a full branch and a short one', () => {
    const board = withStageRules({ texas: branchRules('preview/*') });
    expect(hintedStages(board)).toContain('texas');
  });
});

describe('Amplify window hints that keep the app-wide judgement', () => {
  it('hints a cell whose stage rule is not exactly a branch pattern', () => {
    const notPattern = branchRule('dev');
    const board = withStageRules({
      dev: {
        ...branchRules('dev'),
        amplify: {
          ...notPattern,
          combine: 'or',
          checks: [...notPattern.checks, ...notPattern.checks],
        },
      },
    });
    expect(hintedStages(board)).toContain('dev');
  });

  it('hints a cell with no Amplify stage rule', () => {
    const board = withStageRules({ dev: { github: branchRule('dev') } });
    expect(hintedStages(board)).toContain('dev');
  });

  it('hints every empty cell under a custom Amplify source rule', () => {
    const board = customiseSource(
      measureBoard,
      sourceRuleFor(measureBoard, 'amplify').id,
    );
    expect(hintedStages(board)).toEqual(
      expect.arrayContaining(['dev', 'texas', 'prod']),
    );
  });
});
