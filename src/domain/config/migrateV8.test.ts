/**
 * Tests for the v7 → v8 migration (spec §3.L, Decision 113): the v7
 * fixture becomes the v8 fixture, every dashboard field as it was and its
 * settings gaining `hiddenPolling` at the v8 defaults; the step is
 * idempotent, keeps hidden polling already there, and leaves a malformed
 * dashboard list or settings for validation to refuse; a stored v7 board
 * migrates through `migrate` to a valid current one.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import v7Board from './fixtures/v7-board.json';
import v8Board from './fixtures/v8-board.json';
import { migrate } from './migrate';
import { toV8 } from './migrateV8';
import { CURRENT_SCHEMA_VERSION } from './root';

/** The hidden polling v8 gives a dashboard: literal, as the step's. */
const V8_HIDDEN_POLLING = { periodMs: 300_000, rampFactor: 0.25 };

describe('toV8', () => {
  it("gives each dashboard's settings the v8 hidden polling, every other field as stored", () => {
    expect(toV8(v7Board)).toEqual(v8Board);
    v7Board.dashboards.forEach((before, index) => {
      const after = v8Board.dashboards[index];
      expect(after.settings.hiddenPolling).toEqual(V8_HIDDEN_POLLING);
      const fields = Object.entries(before).filter(([f]) => f !== 'settings');
      for (const [field, value] of fields)
        expect(after).toHaveProperty([field], value);
      for (const [field, value] of Object.entries(before.settings))
        expect(after.settings).toHaveProperty([field], value);
      expect(Object.keys(after.settings).sort()).toEqual(
        [...Object.keys(before.settings), 'hiddenPolling'].sort(),
      );
    });
  });

  it('is idempotent', () => {
    expect(toV8(toV8(v7Board))).toEqual(toV8(v7Board));
  });

  it('keeps hidden polling already there', () => {
    const own = { periodMs: 600_000, rampFactor: 0.5 };
    const input = {
      dashboards: [{ id: 'a', name: 'A', settings: { hiddenPolling: own } }],
    };
    expect(toV8(input)).toEqual(input);
  });

  it('gives a dashboard with no settings the v8 hidden polling', () => {
    expect(toV8({ dashboards: [{ id: 'a', name: 'A' }] })).toEqual({
      dashboards: [
        { id: 'a', name: 'A', settings: { hiddenPolling: V8_HIDDEN_POLLING } },
      ],
    });
  });

  it('leaves a malformed dashboard list, and validation refuses it', () => {
    const input = { schemaVersion: 7, dashboards: 'not a list' };
    expect(toV8(input)).toBe(input);
    expect(() => migrate(input)).toThrow();
  });

  it('leaves malformed settings for validation to refuse', () => {
    const input = {
      schemaVersion: 7,
      dashboards: [{ id: 'a', name: 'A', settings: 'none' }],
    };
    expect(toV8(input)).toEqual(input);
    expect(() => migrate(input)).toThrow();
  });

  it('migrates a stored v7 board to a valid current one', () => {
    const root = migrate({ ...v7Board, schemaVersion: 7 });
    expect(root.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    for (const dashboard of root.dashboards)
      expect(dashboard.settings.hiddenPolling).toEqual(V8_HIDDEN_POLLING);
  });
});
