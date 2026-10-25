/**
 * The measurement scenario on the board (spec.md §3.14 *Measurement
 * scenario*, Q29): the 19 × 6 board of C-23 read through the simulator,
 * with each provider error mapped as on a real board: a rejected token
 * (`401`) asks for a credential, a faulted repo (`500`) shows *Error*, a
 * missing branch and a branch no workflow runs on show *no records*; and
 * C-23's badges, live runs and unmapped runs as they were.
 */
import { describe, expect, it } from 'vitest';

import { createBoardModel } from '@/engine';
import { cellKey } from '@/engine/types';
import { demoEnv, settle } from '@/test/boardModel';

import { measureScenario } from './measure';

const board = measureScenario.dashboard;

/** Building a whole demo board takes seconds, more on a busy runner. */
const BOARD_TEST_TIMEOUT_MS = 60_000;

describe('the measurement scenario', () => {
  it(
    "maps each provider error as a real board does, and shows C-23's cells",
    async () => {
      const env = demoEnv(() => 0, undefined, measureScenario);
      const handle = createBoardModel({ dashboard: board, env });
      const model = await settle(env, handle);
      handle.destroy();
      const cell = (row: string, stage: string) =>
        model.cells[cellKey(row, stage)];
      const look = (row: string, stage: string) => {
        const d = cell(row, stage)?.derivation;
        return d?.kind === 'ok' ? d.status.id : d?.state;
      };
      for (const stage of board.stages) {
        expect(look('legacy-billing', stage.id)).toBe('needs-credential');
        expect(look('flaky-svc', stage.id)).toBe('error');
      }
      expect(look('auth-service', 'release')).toBe('no-records');
      expect(look('inventory', 'texas')).toBe('no-records');
      expect(look('partner-portal', 'texas')).toBe('no-records');
      expect(look('mobile-bff', 'prod')).toBe('testFailed');
      expect(look('payments', 'dev')).toBe('cancelled');
      expect(look('web-app', 'texas')).toBe('queued');
      expect(look('web-app', 'bali')).toBe('partial');
      expect(look('marketing-site', 'prod')).toBe('failed');
      expect(cell('billing', 'bali')?.badge?.kind).toBe('behind');
      expect(cell('shipping', 'prod')?.badge?.kind).toBe('behind');
      expect(cell('orders', 'spokane')?.badge?.kind).toBe('diverged');
      expect(
        model.unmapped.map((u) => `${u.where} ${u.branch ?? ''}`).sort(),
      ).toEqual([
        'acme/api-core hotfix/login',
        'acme/payments dev',
        'acme/web-app dev',
      ]);
    },
    BOARD_TEST_TIMEOUT_MS,
  );
});
