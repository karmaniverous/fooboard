/**
 * Config migration entry point (spec.md C-2, §5: "config schema bumps ship
 * with an import migration"). Applies any migrations needed to bring
 * arbitrary stored or imported data up to `CURRENT_SCHEMA_VERSION`, then
 * validates it against `ConfigRootSchema`.
 *
 * Steps so far: v1 to v2, row and column groups replacing dividers
 * (spec.md C-14b).
 *
 * @module
 */
import { omit, sort } from 'radash';
import { z } from 'zod';

import type { ConfigRoot } from './root';
import { ConfigRootSchema, CURRENT_SCHEMA_VERSION } from './root';

/** A migration step from one schema version to the next. */
type Migration = (input: Record<string, unknown>) => Record<string, unknown>;

/** The parts of a v1 dashboard the v1 to v2 step reads; anything else is
 * passed through for `ConfigRootSchema` to validate. */
const V1DividerSchema = z.object({
  beforeId: z.string(),
  label: z.string().min(1).optional(),
});
const V1DashboardSchema = z.looseObject({
  rows: z.array(z.looseObject({ id: z.string() })).default([]),
  stages: z.array(z.looseObject({ id: z.string() })).default([]),
  rowDividers: z.array(V1DividerSchema).default([]),
  columnDividers: z.array(V1DividerSchema).default([]),
});

/** One group per divider (spec.md C-14b): a labelled divider becomes a
 * labelled group, an unlabelled one an unlabelled group; the group runs
 * from the divider's row or stage up to the next divider. Items before the
 * first divider stay ungrouped. Divider styles are dropped. */
function groupsFromDividers(
  itemIds: readonly string[],
  dividers: readonly z.infer<typeof V1DividerSchema>[],
): { id: string; label?: string; memberIds: string[] }[] {
  const positioned = sort(
    dividers
      .map((d) => ({ ...d, index: itemIds.indexOf(d.beforeId) }))
      .filter((d) => d.index >= 0),
    (d) => d.index,
  );
  return positioned.map((d, i) => ({
    id: `group-${d.beforeId}`,
    ...(d.label ? { label: d.label } : {}),
    memberIds: itemIds.slice(d.index, positioned[i + 1]?.index),
  }));
}

/** v1 to v2 for one dashboard: dividers become groups (spec.md C-14b).
 * Data that doesn't have a v1 dashboard's shape is rejected here: the v2
 * schema would drop the bad dividers silently, and the store would then
 * overwrite the original on the next save. */
function dividersToGroups(input: unknown): unknown {
  const parsed = V1DashboardSchema.safeParse(input);
  if (!parsed.success) throw parsed.error;
  const { rows, stages, rowDividers, columnDividers } = parsed.data;
  return {
    ...omit(parsed.data, ['rowDividers', 'columnDividers']),
    rowGroups: groupsFromDividers(
      rows.map((r) => r.id),
      rowDividers,
    ),
    columnGroups: groupsFromDividers(
      stages.map((s) => s.id),
      columnDividers,
    ),
  };
}

/** Migrations keyed by the version they migrate *from*. `Partial` so a
 * missing step types as `undefined` (there is no `noUncheckedIndexedAccess`
 * project-wide). */
const migrations: Partial<Record<number, Migration>> = {
  1: (data) => ({
    ...data,
    dashboards: Array.isArray(data.dashboards)
      ? data.dashboards.map(dividersToGroups)
      : data.dashboards,
  }),
};
function readVersion(input: unknown): number {
  if (
    typeof input === 'object' &&
    input !== null &&
    'schemaVersion' in input &&
    typeof input.schemaVersion === 'number'
  ) {
    return input.schemaVersion;
  }
  return 0;
}

/**
 * Migrate arbitrary data (from local storage, an import file or a share
 * link) to the current config schema, applying every migration step in
 * order, then parse and validate the result.
 */
export function migrate(input: unknown): ConfigRoot {
  let version = readVersion(input);
  let data: Record<string, unknown> = z
    .record(z.string(), z.unknown())
    .catch({})
    .parse(input);

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error(
      `schema version ${String(version)} is newer than ${String(CURRENT_SCHEMA_VERSION)}; update fooboard to import this file`,
    );
  }

  while (version < CURRENT_SCHEMA_VERSION) {
    const step = migrations[version];
    if (!step) {
      throw new Error(
        `no migration from schema version ${String(version)} to ${String(CURRENT_SCHEMA_VERSION)}`,
      );
    }
    version += 1;
    data = { ...step(data), schemaVersion: version };
  }

  return ConfigRootSchema.parse(data);
}
