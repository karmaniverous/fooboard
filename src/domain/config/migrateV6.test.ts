/**
 * Tests for the v5 → v6 migration (spec.md §3.13, Decision 51): every
 * field mapped to its v6 place (a v5 board shaped like a real one, with
 * fictional names: Amplify rows pinning apps across three AWS keys, row
 * and column groups, cell status sets), idempotence, a stored v4 board
 * through the v4 → v5 → v6 chain, and migrated rows reading what they
 * read before (the documented exception: a row whose sources named
 * several keys reads the key its cells inherit, with a note on the other
 * pins).
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { cellRulesFor } from '@/domain/config/cellRules';
import { always } from '@/domain/rules/always';
import { unusedPins } from '@/domain/settings/pins';
import { pinsFor } from '@/domain/settings/pins';
import { resolveSetting } from '@/domain/settings/resolve';

import { type Dashboard, DashboardSchema } from './dashboard';
import v4Board from './fixtures/v4-board.json';
import v5Board from './fixtures/v5-board.json';
import v6Board from './fixtures/v6-board.json';
import { migrate } from './migrate';
import { toV6 } from './migrateV6';
import type { Row } from './row';

/** The migrated board, validated. */
const board: Dashboard = migrate(v5Board).dashboards[0];
const rowOf = (id: string): Row => {
  const row = board.rows.find((r) => r.id === id);
  if (!row) throw new Error(`no row ${id}`);
  return row;
};
const stageIds = board.stages.map((s) => s.id);
/** What each cell of a row reads for `field`. */
const perCell = (id: string, field: 'githubToken' | 'awsKey' | 'statusSets') =>
  stageIds.map((s) => resolveSetting(board, rowOf(id), s, field).value);

describe('toV6', () => {
  it('maps every v5 field to its v6 place, values as stored', () => {
    expect(toV6(v5Board)).toEqual(v6Board);
  });

  it('is idempotent', () => {
    expect(toV6(toV6(v5Board))).toEqual(toV6(v5Board));
  });

  it('keeps a value already in its v6 place over the v5 one', () => {
    const chosen = { github: 'github-single-job', amplify: 'mine' };
    expect(
      toV6({
        dashboards: [
          {
            defaultCredentials: { github: 'old' },
            settings: { githubToken: 'new', statusSets: chosen },
          },
        ],
      }),
    ).toEqual({
      dashboards: [{ settings: { githubToken: 'new', statusSets: chosen } }],
    });
  });

  it("merges a per-source field source by source, v6's own winning", () => {
    expect(
      toV6({
        dashboards: [
          {
            statusSets: { github: 'v5-gh', amplify: 'v5-amp' },
            settings: { statusSets: { github: 'v6-gh' } },
          },
        ],
      }),
    ).toEqual({
      dashboards: [
        { settings: { statusSets: { github: 'v6-gh', amplify: 'v5-amp' } } },
      ],
    });
  });

  it('gives a dashboard v5 stored no status sets the v5 defaults', () => {
    expect(toV6({ dashboards: [{ id: 'd', name: 'D' }] })).toEqual({
      dashboards: [
        {
          id: 'd',
          name: 'D',
          settings: {
            statusSets: { github: 'github-deploy-test', amplify: 'amplify' },
          },
        },
      ],
    });
  });

  it("keeps a source's other rule fields when dropping its items", () => {
    const record = { combine: 'and', checks: [] };
    expect(
      toV6({
        dashboards: [{ rowRules: { amplify: { record, items: record } } }],
      }),
    ).toEqual({
      dashboards: [
        expect.objectContaining({ rowRules: { amplify: { record } } }),
      ],
    });
  });

  it('leaves malformed lists and unknown row types for validation to refuse', () => {
    const odd = { type: 'gitlab', id: 'x', credentialId: 'c' };
    expect(toV6({ dashboards: 'nope' })).toEqual({ dashboards: 'nope' });
    expect(toV6({ dashboards: [{ rows: [odd], stages: 3 }] })).toEqual({
      dashboards: [expect.objectContaining({ rows: [odd], stages: 3 })],
    });
    expect(toV6({})).toEqual({ dashboards: [] });
    // A row group without row rules gains none.
    expect(toV6({ dashboards: [{ rowGroups: [{ id: 'g' }] }] })).toEqual({
      dashboards: [
        expect.objectContaining({ rowGroups: [{ id: 'g', settings: {} }] }),
      ],
    });
  });
});

describe('the migrated board', () => {
  it('validates as v6, with the backup-worthy version bumped', () => {
    expect(migrate(v5Board).schemaVersion).toBe(6);
    expect(DashboardSchema.safeParse(board).success).toBe(true);
  });

  it('reads with the same GitHub tokens, status sets and item rules', () => {
    expect(perCell('orders-api', 'githubToken')).toEqual(
      stageIds.map(() => 'gh-org'),
    );
    expect(perCell('billing-api', 'githubToken')).toEqual(
      stageIds.map(() => 'gh-org'),
    );
    expect(perCell('portal', 'githubToken')).toEqual(
      stageIds.map(() => 'gh-org'),
    );
    expect(perCell('orders-api', 'statusSets')).toEqual([
      'github-single-job',
      'github-deploy-test',
      'github-deploy-test',
      'github-deploy-test',
    ]);
    expect(perCell('billing-api', 'statusSets')).toEqual(
      stageIds.map(() => 'github-single-job'),
    );
    expect(
      cellRulesFor(board, rowOf('orders-api'), 'dev').items.checks[0]?.value,
    ).toBe('*orders*');
    expect(
      cellRulesFor(board, rowOf('billing-api'), 'dev').items.checks[0]?.value,
    ).toBe('*deploy*');
    expect(
      cellRulesFor(board, rowOf('admin'), 'dev').items.checks[0]?.value,
    ).toBe('RELEASE');
    expect(cellRulesFor(board, rowOf('kiosk'), 'dev').items).toEqual(always);
    expect(
      cellRulesFor(board, rowOf('orders-api'), 'dev').record.checks[0]?.value,
    ).toBe('Deploy*');
  });

  it('reads each single-key Amplify row with its key and all its apps', () => {
    const admin = rowOf('admin');
    const kiosk = rowOf('kiosk');
    if (admin.type !== 'amplify' || kiosk.type !== 'amplify')
      throw new Error('amplify');
    expect(perCell('admin', 'awsKey')).toEqual(stageIds.map(() => 'aws-prod'));
    expect(pinsFor(admin, 'aws-prod').map((p) => p.appId)).toEqual([
      'd1adminstage',
      'd1adminprod',
    ]);
    expect(perCell('kiosk', 'awsKey')).toEqual(stageIds.map(() => 'aws-dev'));
    expect(pinsFor(kiosk, 'aws-dev').map((p) => p.appId)).toEqual(['d1kiosk']);
    expect(unusedPins(board, admin)).toEqual([]);
  });

  it('reads a several-key row with the key its cells inherit, noting the other pins', () => {
    const portal = rowOf('portal');
    if (portal.type !== 'amplify') throw new Error('amplify');
    expect(perCell('portal', 'awsKey')).toEqual(
      stageIds.map(() => 'aws-stage'),
    );
    expect(pinsFor(portal, 'aws-stage').map((p) => p.appId)).toEqual([
      'd1portalstage',
    ]);
    expect(unusedPins(board, portal).map((p) => p.appId)).toEqual([
      'd1portaldev',
      'd1portalprod',
    ]);
    expect(perCell('portal', 'statusSets').at(-1)).toBe('amplify');
  });
});

describe('a stored v4 board', () => {
  it('migrates through v5 to v6', () => {
    const [d] = migrate(v4Board).dashboards;
    expect(d.settings).toEqual({
      requestsInFlight: { github: 10, aws: 10 },
      githubToken: 'gh',
      statusSets: { github: 'github-single-job', amplify: 'amplify' },
    });
    expect(d.rowGroups[0]?.settings).toEqual({ awsKey: 'aws' });
    expect(d.rows[0]).toMatchObject({
      pinnedApps: [{ region: 'us-east-1', appId: 'd1shop' }],
      settings: {},
      cellSettings: {},
    });
    expect(d.stages[0]?.settings).toEqual({});
    expect(resolveSetting(d, d.rows[0], 'prod', 'awsKey').value).toBe('aws');
  });
});

describe('a malformed v5 field', () => {
  const v5 = (
    patch: Record<string, unknown>,
    row: Record<string, unknown> = {},
  ) => ({
    schemaVersion: 5,
    dashboards: [
      {
        id: 'd',
        name: 'D',
        rows: [
          {
            type: 'amplify',
            id: 'site',
            repo: 'acme/site',
            displayName: 'site',
            sources: [{ region: 'us-east-1', appId: 'a1' }],
            ...row,
          },
        ],
        ...patch,
      },
    ],
  });

  it('migrates the well-formed board it is checked against', () => {
    expect(migrate(v5({})).dashboards[0].rows[0]).toMatchObject({
      pinnedApps: [{ region: 'us-east-1', appId: 'a1' }],
    });
  });

  it.each<[string, Record<string, unknown>, Record<string, unknown>?]>([
    ['defaultCredentials', { defaultCredentials: 'oops' }],
    ['statusSets', { statusSets: 'oops' }],
    ['rowRules', { rowRules: 'oops' }],
    ['github', { rowRules: { github: 'oops' } }],
    [
      'statusSets',
      { rowGroups: [{ id: 'g', memberIds: ['site'], statusSets: 7 }] },
    ],
    ['cellStatusSets', {}, { cellStatusSets: ['oops'] }],
    ['sources', {}, { sources: 'oops' }],
    ['sources', {}, { sources: [] }],
  ])(
    'refuses the board rather than dropping a malformed %s',
    (field, patch, row) => {
      expect(() => migrate(v5(patch, row))).toThrow(`malformed ${field}`);
    },
  );
});
