/**
 * Tests for `migrate`, the config migration entry point (spec.md C-2),
 * including v1 dividers becoming v2 groups (C-14b).
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { migrate } from './migrate';

describe('migrate', () => {
  it('validates and returns already-current data', () => {
    const input = { schemaVersion: 3, dashboards: [] };
    expect(migrate(input)).toEqual(input);
  });

  it('defaults a missing dashboards array', () => {
    expect(migrate({ schemaVersion: 3 })).toEqual({
      schemaVersion: 3,
      dashboards: [],
    });
  });

  it('migrates a v1 dashboard: each divider starts a group running to the next', () => {
    const out = migrate({
      schemaVersion: 1,
      dashboards: [
        {
          id: 'd',
          name: 'd',
          rows: ['a', 'b', 'c'].map((id) => ({
            type: 'github',
            id,
            repo: `o/${id}`,
            displayName: id,
          })),
          stages: [
            { id: 's1', name: 's1', branchPattern: 'x' },
            { id: 's2', name: 's2', branchPattern: 'y' },
          ],
          rowDividers: [
            { beforeId: 'c', style: 'thin' },
            { beforeId: 'b', style: 'thick', label: 'Back' },
          ],
          columnDividers: [{ beforeId: 's2', style: 'dashed', label: 'Prod' }],
        },
      ],
    });
    expect(out.schemaVersion).toBe(3);
    const d = out.dashboards[0];
    expect(d).not.toHaveProperty('rowDividers');
    expect(d.rowGroups).toEqual([
      {
        id: 'group-b',
        label: 'Back',
        memberIds: ['b'],
        branchPatternOverrides: {},
        defaultCredentials: {},
        statusSets: {},
      },
      {
        id: 'group-c',
        memberIds: ['c'],
        branchPatternOverrides: {},
        defaultCredentials: {},
        statusSets: {},
      },
    ]);
    expect(d.columnGroups).toEqual([
      { id: 'group-s2', label: 'Prod', memberIds: ['s2'] },
    ]);
    expect(d.rows[0].branchPatternOverrides).toEqual({});
  });

  it('migrates a v1 dashboard without dividers, and leaves malformed ones to validation', () => {
    const v1 = (dashboard: unknown) =>
      migrate({ schemaVersion: 1, dashboards: [dashboard] });
    expect(v1({ id: 'd', name: 'd' }).dashboards[0]).toMatchObject({
      rowGroups: [],
      columnGroups: [],
    });
    expect(() => v1('not a dashboard')).toThrow();
    expect(() => v1({ id: 'd', name: 'd', rows: [{ repo: 'o/r' }] })).toThrow();
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

  it('rejects a v1 dashboard whose dividers are malformed, instead of dropping them', () => {
    expect(() =>
      migrate({
        schemaVersion: 1,
        dashboards: [{ id: 'd', name: 'd', rowDividers: null }],
      }),
    ).toThrow();
  });
});
