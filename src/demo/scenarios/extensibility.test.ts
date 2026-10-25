/**
 * Scenario extensibility (spec.md §3.14 *Scenario*): adding a repo to the
 * shipped scenario, with its branches and workflow, the token's access
 * and a board row, needs no engine change: the new row fills like any
 * other, and the existing rows read as before.
 */
import { describe, expect, it } from 'vitest';

import { parseScenario } from '@/demo/sim/scenario';
import { createBoardModel } from '@/engine';
import { cellKey } from '@/engine/types';
import { demoEnv, settle } from '@/test/boardModel';

import { acmeScenario } from './acme';
import { ACME_BRANCHES } from './acmeBoard';
import { workflow } from './pipeline';

const NEW_REPO = 'acme/loyalty';

const extended = parseScenario({
  ...acmeScenario,
  github: {
    tokens: acmeScenario.github.tokens.map((t) => ({
      ...t,
      repos: [...t.repos, NEW_REPO],
    })),
    repos: [
      ...acmeScenario.github.repos,
      {
        fullName: NEW_REPO,
        branches: Object.values(ACME_BRANCHES).map((name) => ({
          name,
          ...(name === ACME_BRANCHES.dev
            ? { commitsEveryMs: [10 * 60_000, 20 * 60_000] as [number, number] }
            : {}),
        })),
        workflows: [
          workflow('Deploy', Object.values(ACME_BRANCHES), [
            ['deploy', [1, 2]],
            ['test', [1, 2]],
          ]),
        ],
      },
    ],
  },
  promotions: acmeScenario.promotions,
  dashboard: {
    ...acmeScenario.dashboard,
    rows: [
      ...acmeScenario.dashboard.rows,
      { type: 'github', id: 'loyalty', repo: NEW_REPO, displayName: 'loyalty' },
    ],
  },
});

const fill = async (scenario: typeof acmeScenario) => {
  const env = demoEnv(() => 0, undefined, scenario);
  const board = createBoardModel({ dashboard: scenario.dashboard, env });
  const model = await settle(env, board);
  board.destroy();
  return model;
};

/** Building a whole demo board takes seconds, more on a busy runner. */
const BOARD_TEST_TIMEOUT_MS = 60_000;

describe('adding a repo to the scenario', () => {
  it(
    'fills its row with no engine change, leaving the rest as they were',
    async () => {
      const [before, after] = await Promise.all([
        fill(acmeScenario),
        fill(extended),
      ]);
      for (const stage of extended.dashboard.stages)
        expect(after.cells[cellKey('loyalty', stage.id)]?.derivation.kind).toBe(
          'ok',
        );
      for (const row of acmeScenario.dashboard.rows)
        for (const stage of acmeScenario.dashboard.stages) {
          const key = cellKey(row.id, stage.id);
          expect(after.cells[key]?.derivation).toEqual(
            before.cells[key]?.derivation,
          );
        }
    },
    BOARD_TEST_TIMEOUT_MS,
  );
});
