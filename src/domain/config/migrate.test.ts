/**
 * Tests for loading configurations across data model versions (spec.md
 * A§4.3.7): the current version validates as is; a newer one, or one from
 * before the chain starts, is refused with a message saying why; each
 * step of the chain runs in order.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { addSettings, FIRST_VERSION, migrate } from './migrate';
import { CURRENT_SCHEMA_VERSION } from './root';
import { defaultSettings } from './settings';

describe('migrate', () => {
  it('validates and returns current data, defaulting missing dashboards', () => {
    const input = { schemaVersion: CURRENT_SCHEMA_VERSION, dashboards: [] };
    expect(migrate(input)).toEqual(input);
    expect(migrate({ schemaVersion: CURRENT_SCHEMA_VERSION })).toEqual(input);
  });

  it.each([
    [99, /^made with a newer fooboard; reload to update$/],
    [3, /early development build/],
    [1, /early development build/],
  ])('refuses schema version %i', (schemaVersion, message) => {
    expect(() => migrate({ schemaVersion, dashboards: [] })).toThrow(message);
  });

  it('refuses input that is not a configuration', () => {
    expect(() => migrate(null)).toThrow();
    expect(() => migrate('not a config')).toThrow();
  });

  it('runs each step of the chain in order up to the current version', () => {
    const seen: number[] = [];
    const out = migrate(
      { schemaVersion: CURRENT_SCHEMA_VERSION - 2, marks: [] },
      {
        [CURRENT_SCHEMA_VERSION - 2]: (d) => {
          seen.push(1);
          return d;
        },
        [CURRENT_SCHEMA_VERSION - 1]: (d) => {
          seen.push(2);
          return { ...d, dashboards: [] };
        },
      },
      CURRENT_SCHEMA_VERSION - 2,
    );
    expect(seen).toEqual([1, 2]);
    expect(out.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it('migrates v4 to v5, giving each dashboard default settings', () => {
    const v4 = {
      schemaVersion: FIRST_VERSION,
      dashboards: [
        { id: 'a', name: 'A' },
        {
          id: 'b',
          name: 'B',
          settings: { requestsInFlight: { github: 3, aws: 4 } },
        },
      ],
    };
    const out = migrate(v4);
    expect(out.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(out.dashboards.map((d) => d.settings)).toEqual([
      defaultSettings(),
      { requestsInFlight: { github: 3, aws: 4 } },
    ]);
    expect(out.dashboards.map((d) => d.name)).toEqual(['A', 'B']);
  });

  it('writes the v5 settings in the step itself, not leaving them to schema defaults', () => {
    // Frozen in time: a later default must not change what v4 data became.
    const own = { requestsInFlight: { github: 3, aws: 4 } };
    expect(
      addSettings({ dashboards: [{ id: 'a' }, { id: 'b', settings: own }] }),
    ).toEqual({
      dashboards: [
        { id: 'a', settings: defaultSettings() },
        { id: 'b', settings: own },
      ],
    });
  });

  it('changes nothing when the v4 to v5 step runs again', () => {
    const once = addSettings({
      dashboards: [
        { id: 'a' },
        { id: 'b', settings: { requestsInFlight: { github: 3, aws: 4 } } },
      ],
    });
    expect(addSettings(once)).toEqual(once);
  });

  it('refuses a version with no step to the next', () => {
    expect(() =>
      migrate({ schemaVersion: CURRENT_SCHEMA_VERSION - 1 }, {}, 0),
    ).toThrow(/no migration/);
  });
});
