/**
 * The v5 → v6 migration step (spec.md §3.13, Decision 51): every value
 * that may differ by row, column or cell moves into the settings object
 * at its level, copied as stored.
 *
 * - dashboard `defaultCredentials`, `statusSets` and
 *   `rowRules[source].items` → `dashboard.settings` (`githubToken`, `awsKey`, `statusSets`,
 *   `itemRules`); `rowRules[source].record` stays.
 * - row group `defaultCredentials`, `statusSets` and
 *   `rowRules[source].items` → `rowGroups[].settings`; `rowRules[source].record` stays.
 * - a GitHub row's `credentialId`, an Amplify row's `githubCredentialId`,
 *   and a row's `statusSet` and `itemRule` → `rows[].settings`;
 *   `cellStatusSets` → `rows[].cellSettings[stageId].statusSets`.
 * - an Amplify row's `sources` → `pinnedApps`, one per source, the same
 *   fields; when every source names the same key, that key also becomes
 *   the row's `settings.awsKey`.
 * - column groups and stages gain an empty `settings`.
 *
 * A v5 dashboard always stored both status sets (its schema defaulted
 * them); one written without them gets v5's defaults, frozen here, so a
 * later built-in never changes what it becomes. A value already in v6's
 * place is kept over the v5 one, so the step is idempotent. A malformed
 * list is left as it is, for validation to refuse; a v5 field this step
 * moves that isn't the shape v5 stored throws, so the board is refused
 * rather than migrated without it (v6's schemas would strip it).
 *
 * @module
 */
import { omit, shake, unique } from 'radash';
import { z } from 'zod';

type Rec = Record<string, unknown>;

const RecordSchema = z.record(z.string(), z.unknown());
const ListSchema = z.array(RecordSchema);

/** `value` as a plain record, if it is one. */
const record = (value: unknown): Rec | undefined => {
  const parsed = RecordSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
};

/** `value` as a list of records, else `undefined`. */
const list = (value: unknown): Rec[] | undefined => {
  const parsed = ListSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
};

/** `item[key]` as v5 stored it: absent, or `schema`'s shape. Any other
 * value throws: the step moves it, so leaving it for validation would
 * lose it. */
function v5Field<T>(
  item: Rec,
  key: string,
  schema: z.ZodType<T>,
): T | undefined {
  const value = item[key];
  if (value === undefined) return undefined;
  const parsed = schema.safeParse(value);
  if (!parsed.success)
    throw new Error(`can't migrate to data model v6: malformed ${key}`);
  return parsed.data;
}

/** The status sets a v5 dashboard defaulted to: frozen here. */
const V5_STATUS_SET_IDS = { github: 'github-deploy-test', amplify: 'amplify' };

const SOURCES = ['github', 'amplify'] as const;

/** `values` without its `undefined` entries, or `undefined` when none is
 * left. */
const group = (values: Rec): Rec | undefined => {
  const kept = shake(values);
  return Object.keys(kept).length > 0 ? kept : undefined;
};

/** A level's settings from v5's three fields, and its record-only row
 * rules. */
function levelFields(
  level: Rec,
  statusSets: Rec | undefined,
): { settings: Rec; rowRules?: Rec } {
  const credentials = v5Field(level, 'defaultCredentials', RecordSchema) ?? {};
  const rowRules = v5Field(level, 'rowRules', RecordSchema);
  const bySource = (s: string) =>
    rowRules ? v5Field(rowRules, s, RecordSchema) : undefined;
  const items = Object.fromEntries(SOURCES.map((s) => [s, bySource(s)?.items]));
  const records = rowRules
    ? group(
        Object.fromEntries(
          SOURCES.map((s) => {
            const rules = omit(bySource(s) ?? {}, ['items']);
            // A source left with no record rule is dropped.
            return [s, Object.keys(rules).length > 0 ? rules : undefined];
          }),
        ),
      )
    : undefined;
  return {
    settings: shake({
      githubToken: credentials.github,
      awsKey: credentials.aws,
      statusSets: statusSets ? group(statusSets) : undefined,
      itemRules: group(items),
    }),
    rowRules: rowRules ? (records ?? {}) : undefined,
  };
}

/** The per-source settings fields, merged source by source. */
const PER_SOURCE = ['statusSets', 'itemRules'] as const;

/** `level` with v6's settings from `derived` merged under its own (a
 * per-source field source by source), and its v5 fields dropped. A value
 * that isn't a record is kept as it is, for validation to refuse. */
function settle(level: Rec, derived: Rec, dropped: string[]): Rec {
  const own = record(level.settings) ?? {};
  const merged = (key: string): unknown => {
    const mine = own[key];
    const v6 = record(mine);
    if (mine !== undefined && !v6) return mine;
    const v5 = record(derived[key]);
    return v5 || v6 ? { ...v5, ...v6 } : undefined;
  };
  return {
    ...omit(level, dropped),
    settings: shake({
      ...derived,
      ...own,
      ...Object.fromEntries(PER_SOURCE.map((key) => [key, merged(key)])),
    }),
  };
}

/** One row group, v5 → v6. */
function rowGroup(g: Rec): Rec {
  const { settings, rowRules } = levelFields(
    g,
    v5Field(g, 'statusSets', RecordSchema),
  );
  const out = settle(g, settings, ['defaultCredentials', 'statusSets']);
  return rowRules ? { ...out, rowRules } : out;
}

/** An Amplify row's pins and shared key, from its v5 sources. */
function pins(row: Rec): { pinnedApps?: Rec[]; awsKey?: unknown } {
  // v5 required at least one source.
  const sources = v5Field(row, 'sources', ListSchema.min(1));
  if (!sources) return {};
  const keys = unique(sources.map((s) => s.credentialId));
  return {
    pinnedApps: sources.map((s) =>
      shake({ credentialId: s.credentialId, region: s.region, appId: s.appId }),
    ),
    awsKey: keys.length === 1 ? keys[0] : undefined,
  };
}

/** One row, v5 → v6. */
function row(r: Rec): Rec {
  const type = r.type === 'github' || r.type === 'amplify' ? r.type : undefined;
  if (!type) return r;
  const { pinnedApps, awsKey } = type === 'amplify' ? pins(r) : {};
  const derived = shake({
    githubToken: type === 'github' ? r.credentialId : r.githubCredentialId,
    awsKey,
    statusSets: r.statusSet === undefined ? undefined : { [type]: r.statusSet },
    itemRules: r.itemRule === undefined ? undefined : { [type]: r.itemRule },
  });
  const cells = Object.fromEntries(
    Object.entries(v5Field(r, 'cellStatusSets', RecordSchema) ?? {}).map(
      ([stageId, id]) => [stageId, { statusSets: { [type]: id } }],
    ),
  );
  const out = settle(r, derived, [
    'credentialId',
    'githubCredentialId',
    'statusSet',
    'itemRule',
    'cellStatusSets',
    'sources',
  ]);
  return {
    ...out,
    ...(pinnedApps && !('pinnedApps' in r) ? { pinnedApps } : {}),
    cellSettings: { ...cells, ...record(r.cellSettings) },
  };
}

/** A column group or stage gains an empty `settings`. */
const withSettings = (item: Rec): Rec => ({ settings: {}, ...item });

/** One dashboard, v5 → v6. */
function dashboard(d: Rec): Rec {
  const { settings, rowRules } = levelFields(d, {
    ...V5_STATUS_SET_IDS,
    ...v5Field(d, 'statusSets', RecordSchema),
  });
  const out = settle(d, settings, ['defaultCredentials', 'statusSets']);
  const map = (key: string, change: (item: Rec) => Rec): Rec => {
    const items = list(d[key]);
    return items ? { [key]: items.map(change) } : {};
  };
  return {
    ...out,
    ...(rowRules ? { rowRules } : {}),
    ...map('rowGroups', rowGroup),
    ...map('columnGroups', withSettings),
    ...map('stages', withSettings),
    ...map('rows', row),
  };
}

/** v5 → v6 for a whole configuration. */
export const toV6 = (input: Rec): Rec => {
  const dashboards = z
    .array(RecordSchema)
    .optional()
    .safeParse(input.dashboards);
  if (!dashboards.success) return input;
  return { ...input, dashboards: (dashboards.data ?? []).map(dashboard) };
};
