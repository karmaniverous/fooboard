/**
 * The board screen hands the user's interest to its live board model
 * (spec 0.2.0 §3.H *Plumbing*): a click on a row group's label boosts every
 * row of the group, and only those, through `AttentionContext` and
 * `useBoardModel`'s `attend`, so their root queries poll at 5 s.
 *
 * @module
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import { measureBoard } from '@/demo/scenarios/measure';
import { ACTIVE_INTERVAL_MS, IDLE_INTERVAL_MS } from '@/query/intervals';
import { QueryEnvContext } from '@/query/queryEnvContext';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';
import { demoEnv, FILL_TIMEOUT_MS } from '@/test/boardModel';
import { intervalOf, rootQueries } from '@/test/boostBoard';
import { WAIT } from '@/test/timeouts';

import { BoardScreen } from './BoardScreen';

const group = measureBoard.rowGroups.find((g) => g.label === 'Backend');
const rowsIn = (ids: readonly string[]) =>
  measureBoard.rows.filter((r) => ids.includes(r.id));

describe('BoardScreen attention', () => {
  it(
    "boosts a row group's rows when its label is clicked",
    async () => {
      if (!group) throw new Error('no Backend group');
      const env = demoEnv();
      const view = render(
        <MemoryRouter>
          <StoresContext value={createAppStores(memoryStorage())}>
            <QueryEnvContext value={env}>
              <BoardScreen
                dashboard={measureBoard}
                onChange={vi.fn()}
                onOpenSettings={vi.fn()}
              />
            </QueryEnvContext>
          </StoresContext>
        </MemoryRouter>,
      );
      await screen.findByRole('rowheader', { name: /api-core/ }, WAIT);
      const settled = () =>
        waitFor(() => {
          expect(env.client.isFetching()).toBe(0);
        }, WAIT);
      await settled();
      const intervals = (ids: readonly string[]) =>
        rowsIn(ids).flatMap((r) => rootQueries(env.client, r).map(intervalOf));
      const members = group.memberIds;
      const others = measureBoard.rows
        .map((r) => r.id)
        .filter((id) => !members.includes(id));
      // Some members and some other rows are idle before the click.
      expect(intervals(members)).toContain(IDLE_INTERVAL_MS);
      const idleOthers = intervals(others).filter(
        (i) => i === IDLE_INTERVAL_MS,
      ).length;
      expect(idleOthers).toBeGreaterThan(0);
      fireEvent.click(screen.getByRole('rowheader', { name: /Backend/ }));
      expect(new Set(intervals(members))).toEqual(
        new Set([ACTIVE_INTERVAL_MS]),
      );
      expect(
        intervals(others).filter((i) => i === IDLE_INTERVAL_MS),
      ).toHaveLength(idleOthers);
      await settled();
      view.unmount();
    },
    FILL_TIMEOUT_MS,
  );
});
