/**
 * Tests for exceptions in deriving a row (spec.md §3.1, Decision 25):
 * the row's cells show *Error* with the message and the board gets a
 * dismissable problem on that row, while every other row derives as
 * usual; the board doesn't break.
 *
 * @module
 */
import { describe, expect, it, vi } from 'vitest';

import { measureBoard } from '@/demo/scenarios/measure';
import { EMPTY_STATES } from '@/domain/derivation';
import { demoEnv, settle } from '@/test/boardModel';

import { createBoardModel } from './boardModel';
import type * as RowDerive from './rowDerive';

const [broken] = measureBoard.rows;
const BOOM = 'derivation exploded';

vi.mock('./rowDerive', async (importOriginal) => {
  const original = await importOriginal<typeof RowDerive>();
  return {
    ...original,
    deriveRow: (...args: Parameters<typeof original.deriveRow>) => {
      if (args[2].id === broken.id) throw new Error(BOOM);
      return original.deriveRow(...args);
    },
  };
});

describe('board model errors', () => {
  it('shows a row that fails to derive as Error with a dismissable problem, other rows filled', async () => {
    const env = demoEnv();
    const board = createBoardModel({ dashboard: measureBoard, env });
    const model = await settle(env, board);
    const cells = Object.values(model.cells);

    const own = cells.filter((c) => c?.rowId === broken.id);
    expect(own).toHaveLength(measureBoard.stages.length);
    for (const cell of own) {
      expect(cell?.derivation).toMatchObject({
        kind: 'empty',
        state: EMPTY_STATES.error,
      });
      expect(JSON.stringify(cell?.derivation)).toContain(BOOM);
    }
    const note = model.problems.find(
      (p) => p.level.kind === 'row' && p.level.id === broken.id,
    );
    expect(note?.message).toContain(BOOM);
    expect(note?.dismissable).toBe(true);

    const others = cells.filter((c) => c?.rowId !== broken.id);
    expect(others).toHaveLength(
      measureBoard.stages.length * (measureBoard.rows.length - 1),
    );
    expect(
      others.filter((c) => c?.derivation.kind === 'ok').length,
    ).toBeGreaterThan(others.length / 2);
    board.destroy();
  });
});
