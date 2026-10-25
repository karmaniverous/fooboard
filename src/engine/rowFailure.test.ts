/**
 * Tests for `failedRow` (spec.md §3.1, Decision 25): a row whose
 * derivation threw shows *Error* with the message on every cell, gets a
 * dismissable problem whose Fix opens the row, and keeps observing and
 * feeding what it did before, so a later landing can recover it.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { measureBoard } from '@/demo/scenarios/measure';
import { SETTLED } from '@/query/intervals';
import { githubKey } from '@/query/keys';

import type { RowEntry } from './rowDerive';
import { failedRow } from './rowFailure';

const [row] = measureBoard.rows;

const previous: RowEntry = {
  cells: [],
  needs: [
    {
      key: githubKey('demo-github', { call: 'repos', page: 1 }),
      freshness: SETTLED,
    },
  ],
  derivation: { cells: {}, needs: [], problems: [] },
  groups: ['["github","demo-github","acme/api-core"]'],
};

describe('failedRow', () => {
  it('shows the error on every cell, with a dismissable problem on the row', () => {
    const entry = failedRow(measureBoard, row, new Error('boom'), undefined);
    expect(entry.cells.map((c) => c.stageId)).toEqual(
      measureBoard.stages.map((s) => s.id),
    );
    for (const cell of entry.cells)
      expect(cell.derivation).toEqual({
        kind: 'empty',
        state: 'error',
        reason: 'boom',
      });
    expect(entry.derivation.problems).toEqual([
      expect.objectContaining({
        dismissable: true,
        target: { kind: 'row', id: row.id },
      }),
    ]);
    expect(entry.derivation.problems[0]?.message).toContain('boom');
    expect(entry.needs).toEqual([]);
    expect(entry.groups).toEqual([]);
  });

  it('keeps observing and feeding what the row did before', () => {
    const entry = failedRow(measureBoard, row, new Error('boom'), previous);
    expect(entry.needs).toBe(previous.needs);
    expect(entry.groups).toBe(previous.groups);
  });
});
