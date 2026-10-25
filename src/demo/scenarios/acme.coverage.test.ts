/**
 * The demo's coverage (spec.md §3.14 *Coverage*, Decision 54): within
 * `DEMO_COVERAGE_WINDOW_MS` of simulated time from its opening, the
 * shipped scenario's board shows every status of each preset and
 * *Unknown*, behind and diverged badges (one appearing and clearing), a
 * run after load whose cell refreshes while its jobs load, an error, a
 * missing credential, *No app*, *no records* and runs left unmapped on
 * purpose, and it keeps changing (new runs land, commits are promoted).
 */
import { describe, expect, it } from 'vitest';

import { DEMO_COVERAGE_WINDOW_MS } from '@/demo/constants';
import type { Wait } from '@/demo/sim/simulator';
import { PRESET_IDS, UNKNOWN_STATUS_ID } from '@/domain/config/statusSets';
import { presetById } from '@/domain/statuses/presets';
import { createBoardModel } from '@/engine';
import { type BoardModel, cellKey } from '@/engine/types';
import { demoEnv, settle } from '@/test/boardModel';

import { acmeScenario } from './acme';
import { ACME_FRONTEND, ACME_GITHUB, ACME_INFRA } from './acmeBoard';

const STEP_MS = 15_000;
const board = acmeScenario.dashboard;

/** The preset each row reads with. */
const presetOf = (rowId: string): string =>
  (ACME_FRONTEND as readonly string[]).includes(rowId)
    ? PRESET_IDS.amplify
    : rowId === 'notifications'
      ? PRESET_IDS.githubSingleJob
      : rowId === ACME_INFRA
        ? 'terraform'
        : PRESET_IDS.githubDeployTest;

interface Seen {
  statuses: Set<string>;
  empty: Set<string>;
  badges: Set<string>;
  unmapped: Set<string>;
  refreshing: Set<string>;
  /** Each cell's badge over time. */
  badgeTrail: Map<string, (string | undefined)[]>;
  /** Run ids each cell placed over time. */
  placed: Map<string, Set<string>>;
}

function record(seen: Seen, model: BoardModel): void {
  for (const row of board.rows)
    for (const stage of board.stages) {
      const key = cellKey(row.id, stage.id);
      const cell = model.cells[key];
      if (!cell) continue;
      const d = cell.derivation;
      if (d.kind === 'ok') {
        seen.statuses.add(`${presetOf(row.id)}:${d.status.id}`);
        // A run is told apart by its commit and its link.
        seen.placed.set(
          key,
          (seen.placed.get(key) ?? new Set()).add(
            `${d.commit ?? ''} ${d.linkUrl ?? ''}`,
          ),
        );
      } else seen.empty.add(d.state);
      if (cell.badge) seen.badges.add(cell.badge.kind);
      if (cell.refreshing) seen.refreshing.add(key);
      seen.badgeTrail.set(key, [
        ...(seen.badgeTrail.get(key) ?? []),
        cell.badge?.kind,
      ]);
    }
  for (const u of model.unmapped)
    seen.unmapped.add(`${u.where} ${u.branch ?? ''}`);
}

describe('the demo scenario', () => {
  it('shows everything §3.14 lists within the coverage window', async () => {
    let rel = 0;
    const held: (() => void)[] = [];
    // Slow jobs wait until the step after; everything else answers at once.
    const wait: Wait = (ms) =>
      ms >= 5000
        ? new Promise<void>((resolve) => held.push(resolve))
        : Promise.resolve();
    const env = demoEnv(() => rel, wait, acmeScenario);
    const model = createBoardModel({ dashboard: board, env });
    const seen: Seen = {
      statuses: new Set(),
      empty: new Set(),
      badges: new Set(),
      unmapped: new Set(),
      refreshing: new Set(),
      badgeTrail: new Map(),
      placed: new Map(),
    };
    const loaded = await settle(env, model);
    record(seen, loaded);
    const usedAtLoad = loaded.budgets[ACME_GITHUB]?.used ?? 0;
    while (rel < DEMO_COVERAGE_WINDOW_MS) {
      rel += STEP_MS;
      const refetch = env.client.refetchQueries();
      await new Promise((resolve) => setTimeout(resolve, 0));
      record(seen, model.getModel());
      for (const release of held.splice(0)) release();
      await refetch;
      record(seen, await settle(env, model));
    }
    // The rate-limit headers move the battery.
    expect(usedAtLoad).toBeGreaterThan(0);
    expect(model.getModel().budgets[ACME_GITHUB]?.used).toBeGreaterThan(
      usedAtLoad,
    );
    model.destroy();

    const expected = (id: string) =>
      presetById(id).cell.map((s) => `${id}:${s.id}`);
    for (const id of [
      PRESET_IDS.githubDeployTest,
      PRESET_IDS.githubSingleJob,
      PRESET_IDS.amplify,
    ])
      expect(
        [...seen.statuses].filter((s) => s.startsWith(`${id}:`)).sort(),
      ).toEqual(expected(id).sort());
    expect(seen.statuses).toContain(`terraform:${UNKNOWN_STATUS_ID}`);
    expect([...seen.empty].sort()).toEqual([
      'error',
      'needs-credential',
      'no-app',
      'no-records',
    ]);
    expect([...seen.badges].sort()).toEqual(['behind', 'diverged']);
    expect([...seen.unmapped].sort()).toEqual([
      'acme/accounts dev',
      'acme/api-gateway hotfix/checkout-timeout',
    ]);
    expect(seen.refreshing).toContain(cellKey('accounts', 'prod'));
    // A badge appears and clears (catalog's staging, behind then caught up).
    const trail = seen.badgeTrail.get(cellKey('catalog', 'staging')) ?? [];
    const appeared = trail.indexOf('behind');
    expect(appeared).toBeGreaterThan(0);
    expect(trail.slice(appeared).includes(undefined)).toBe(true);
    // New runs keep landing: most cells place more than one run.
    const changed = [...seen.placed.values()].filter(
      (runs) => runs.size > 1,
    ).length;
    expect(changed).toBeGreaterThan(board.rows.length);
  }, 120_000);
});
