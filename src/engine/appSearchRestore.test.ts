/**
 * Tests for reloading a board with a row found by repo (spec.md §3.4,
 * §3.5 `RELOAD_FULL_BOARD_MAX_MS`, §3.12): when the key's opt-in
 * regions reject it the way a browser reads it (a 403 without its error
 * type), the search still finishes with those regions skipped, so every
 * region's answer is kept at rest and the restored board derives the
 * found row in its first pass, like the pinned rows, with no request.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import type { QueryEnv } from '@/query/client';
import { cannedReader, OPT_IN_REJECTION } from '@/test/amplifySdk';
import { settle } from '@/test/boardModel';
import {
  FOUND,
  foundByRepoDashboard as dashboard,
  foundByRepoEnv,
  reloadInto,
} from '@/test/foundByRepo';

import { createBoardModel } from './boardModel';
import { cellKey } from './types';

/** The demo board found by repo, its opt-in regions answering as the
 * real account's do in a browser. */
const realisticEnv = (): QueryEnv =>
  foundByRepoEnv((region) => cannedReader(region, OPT_IN_REJECTION));
describe('reloading a board with a row found by repo', () => {
  it('derives the found row in the first pass, as the pinned rows', async () => {
    const before = realisticEnv();
    const read = createBoardModel({ dashboard, env: before });
    const full = await settle(before, read);
    read.destroy();

    const after = reloadInto(before, realisticEnv());
    const restored = createBoardModel({ dashboard, env: after });
    const first = restored.getModel();
    // (The demo's failing GitHub repos weren't kept, so they read again.)
    const amplifyFetching = after.client.isFetching({
      queryKey: ['amplify'],
    });
    restored.destroy();

    const cellsOf = (model: typeof first, rowId: string) =>
      dashboard.stages.map((s) => model.cells[cellKey(rowId, s.id)]);
    for (const row of dashboard.rows.filter((r) => r.type === 'amplify'))
      expect(cellsOf(first, row.id).every((c) => c?.settled)).toBe(true);
    expect(cellsOf(first, FOUND)).toEqual(cellsOf(full, FOUND));
    expect(cellsOf(first, FOUND).map((c) => c?.derivation.kind)).not.toContain(
      'empty',
    );
    expect(amplifyFetching).toBe(0);
  });
});
