/**
 * Tests for loading configurations across data model versions (spec.md
 * A§4.3.7): the current version validates as is; a newer one, or one from
 * before the chain starts, is refused with a message saying why; each
 * step of the chain runs in order.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { migrate } from './migrate';
import { CURRENT_SCHEMA_VERSION } from './root';

describe('migrate', () => {
  it('validates and returns current data, defaulting missing dashboards', () => {
    const input = { schemaVersion: CURRENT_SCHEMA_VERSION, dashboards: [] };
    expect(migrate(input)).toEqual(input);
    expect(migrate({ schemaVersion: CURRENT_SCHEMA_VERSION })).toEqual(input);
  });

  it.each([
    [99, /newer/],
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

  it('refuses a version with no step to the next', () => {
    expect(() =>
      migrate({ schemaVersion: CURRENT_SCHEMA_VERSION - 1 }, {}, 0),
    ).toThrow(/no migration/);
  });
});
