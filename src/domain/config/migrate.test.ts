/**
 * Tests for `migrate`, the config migration entry point (spec.md C-2).
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { migrate } from './migrate';

describe('migrate', () => {
  it('validates and returns already-current data', () => {
    const input = { schemaVersion: 1, dashboards: [] };
    expect(migrate(input)).toEqual(input);
  });

  it('defaults a missing dashboards array', () => {
    expect(migrate({ schemaVersion: 1 })).toEqual({
      schemaVersion: 1,
      dashboards: [],
    });
  });

  it('throws for a schema version newer than this codebase understands', () => {
    expect(() => migrate({ schemaVersion: 99, dashboards: [] })).toThrow(
      /newer/,
    );
  });

  it('treats non-object input as version 0 and fails validation', () => {
    expect(() => migrate(null)).toThrow();
    expect(() => migrate('not a config')).toThrow();
  });
});
