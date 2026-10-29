/**
 * Tests for the v6 → v7 migration (spec 0.2.0 §3.I, Decision 86): the
 * v6 fixture becomes the v7 fixture, every dashboard field as it was plus
 * an empty `unmappedDismissals`; the step is idempotent, keeps a list
 * already there, and leaves a malformed dashboard list (or a malformed
 * dismissal list) for validation to refuse; a stored v6 board migrates
 * through `migrate` to a valid v7 one.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import v6Board from './fixtures/v6-board.json';
import v7Board from './fixtures/v7-board.json';
import { migrate } from './migrate';
import { toV7 } from './migrateV7';
import { CURRENT_SCHEMA_VERSION } from './root';

const DISMISSAL = { id: 'd1', workflow: 'Nightly' };

describe('toV7', () => {
  it('gives each dashboard an empty dismissal list, every other field as stored', () => {
    const migrated = toV7(v6Board);
    expect(migrated).toEqual(v7Board);
    v6Board.dashboards.forEach((before, index) => {
      const after = v7Board.dashboards[index];
      expect(after.unmappedDismissals).toEqual([]);
      for (const [field, value] of Object.entries(before))
        expect(after).toHaveProperty([field], value);
      expect(Object.keys(after).sort()).toEqual(
        [...Object.keys(before), 'unmappedDismissals'].sort(),
      );
    });
  });

  it('is idempotent', () => {
    expect(toV7(toV7(v6Board))).toEqual(toV7(v6Board));
  });

  it('keeps a dismissal list already there', () => {
    const input = {
      dashboards: [{ id: 'a', name: 'A', unmappedDismissals: [DISMISSAL] }],
    };
    expect(toV7(input)).toEqual(input);
  });

  it('leaves a malformed dashboard list, and validation refuses it', () => {
    const input = { schemaVersion: 6, dashboards: 'not a list' };
    expect(toV7(input)).toBe(input);
    expect(() => migrate(input)).toThrow();
  });

  it('leaves a malformed dismissal list for validation to refuse', () => {
    const input = {
      schemaVersion: 6,
      dashboards: [{ id: 'a', name: 'A', unmappedDismissals: 'none' }],
    };
    expect(toV7(input)).toEqual(input);
    expect(() => migrate(input)).toThrow();
  });

  it('migrates a stored v6 board to a valid v7 one', () => {
    const root = migrate({ ...v6Board, schemaVersion: 6 });
    expect(root.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(root.schemaVersion).toBe(7);
    for (const dashboard of root.dashboards)
      expect(dashboard.unmappedDismissals).toEqual([]);
  });
});
