/**
 * Tests for loading configurations across data model versions (spec.md
 * A§4.3.7): the current version validates as is; a newer one, or one from
 * before the chain starts, is refused with a message saying why; each
 * step of the chain runs in order.
 *
 * @module
 */
import { describe, expect, it, vi } from 'vitest';

import { addSettings, FIRST_VERSION, migrate } from './migrate';
import { CURRENT_SCHEMA_VERSION } from './root';
import type * as Settings from './settings';

// Today's default moves on; what v4 data migrates to must not.
vi.mock('./settings', async (importOriginal) => ({
  ...(await importOriginal<typeof Settings>()),
  DEFAULT_REQUESTS_IN_FLIGHT: 3,
  defaultSettings: () => ({ requestsInFlight: { github: 3, aws: 3 } }),
}));

/** The settings v5 gave every v4 dashboard: literal, so a change to
 * today's defaults can't move them. */
const V5_SETTINGS = { requestsInFlight: { github: 10, aws: 10 } };

/** The status sets v6 gives a dashboard v5 stored none for: literal too. */
const V5_STATUS_SETS = { github: 'github-deploy-test', amplify: 'amplify' };

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

  it('migrates v4 through v5 to v6, giving each dashboard default settings', () => {
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
      { ...V5_SETTINGS, statusSets: V5_STATUS_SETS },
      { requestsInFlight: { github: 3, aws: 4 }, statusSets: V5_STATUS_SETS },
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
        { id: 'a', settings: V5_SETTINGS },
        { id: 'b', settings: own },
      ],
    });
  });

  it.each([
    [
      'an invalid element beside a valid dashboard',
      [{ id: 'a', name: 'A' }, null],
    ],
    ['a list that is not a list', 'dashboards'],
  ])('refuses v4 data with %s, never emptying it', (_, dashboards) => {
    expect(() =>
      migrate({ schemaVersion: FIRST_VERSION, dashboards }),
    ).toThrow();
  });

  it('gives v4 data with no dashboard list an empty one', () => {
    expect(migrate({ schemaVersion: FIRST_VERSION }).dashboards).toEqual([]);
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
