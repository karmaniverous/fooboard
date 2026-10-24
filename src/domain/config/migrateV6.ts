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
 * list is left as it is, for validation to refuse.
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
  const credentials = record(level.defaultCredentials) ?? {};
  const rowRules = record(level.rowRules);
  const items = Object.fromEntries(
    SOURCES.map((s) => [s, record(rowRules?.[s])?.items]),
  );
  const records = rowRules
    ? group(
        Object.fromEntries(
          SOURCES.map((s) => {
            const rules = omit(record(rowRules[s]) ?? {}, ['items']);
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

/** `level` with v6's settings from `derived` merged under its own, and
 * its v5 fields dropped. */
function settle(level: Rec, derived: Rec, dropped: string[]): Rec {
  return {
    ...omit(level, dropped),
    settings: { ...derived, ...record(level.settings) },
  };
}

/** One row group, v5 → v6. */
function rowGroup(g: Rec): Rec {
  const { settings, rowRules } = levelFields(g, record(g.statusSets));
  const out = settle(g, settings, ['defaultCredentials', 'statusSets']);
  return rowRules ? { ...out, rowRules } : out;
}

/** An Amplify row's pins and shared key, from its v5 sources. */
function pins(row: Rec): { pinnedApps?: Rec[]; awsKey?: unknown } {
  const sources = list(row.sources);
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
    Object.entries(record(r.cellStatusSets) ?? {}).map(([stageId, id]) => [
      stageId,
      { statusSets: { [type]: id } },
    ]),
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
    ...record(d.statusSets),
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
