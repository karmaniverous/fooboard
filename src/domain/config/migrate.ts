/**
 * Config migration entry point (spec.md C-2, §5: "config schema bumps ship
 * with an import migration"). Applies any migrations needed to bring
 * arbitrary stored or imported data up to `CURRENT_SCHEMA_VERSION`, then
 * validates it against `ConfigRootSchema`.
 *
 * There is only one schema version so far, so the migration registry is
 * empty; it is the place future version bumps plug into.
 *
 * @module
 */
import type { ConfigRoot } from './root';
import { ConfigRootSchema, CURRENT_SCHEMA_VERSION } from './root';

/** A migration step from one schema version to the next. */
type Migration = (input: Record<string, unknown>) => Record<string, unknown>;

interface V1Divider {
  beforeId: string;
  style?: string;
  label?: string;
}

/** One group per divider (spec.md C-14b migration): a labelled divider
 * becomes a labelled group, an unlabelled one an unlabelled group; the
 * group runs from the divider's row/stage up to the next divider. Items
 * before the first divider stay ungrouped. Divider styles are dropped. */
function groupsFromDividers(
  itemIds: readonly string[],
  dividers: readonly V1Divider[],
): { id: string; label?: string; memberIds: string[] }[] {
  const positioned = dividers
    .map((d) => ({ ...d, index: itemIds.indexOf(d.beforeId) }))
    .filter((d) => d.index >= 0)
    .sort((a, b) => a.index - b.index);
  return positioned.map((d, i) => {
    const end = positioned[i + 1]?.index ?? itemIds.length;
    return {
      id: `group-${d.beforeId}`,
      ...(d.label ? { label: d.label } : {}),
      memberIds: itemIds.slice(d.index, end),
    };
  });
}

/** Migrate one v1 dashboard's `rowDividers`/`columnDividers` to v2's
 * `rowGroups`/`columnGroups` (spec.md C-14b). */
function migrateDashboardDividersToGroups(
  dashboard: Record<string, unknown>,
): Record<string, unknown> {
  const rows = Array.isArray(dashboard.rows)
    ? (dashboard.rows as { id: string }[])
    : [];
  const stages = Array.isArray(dashboard.stages)
    ? (dashboard.stages as { id: string }[])
    : [];
  const rowDividers = Array.isArray(dashboard.rowDividers)
    ? (dashboard.rowDividers as V1Divider[])
    : [];
  const columnDividers = Array.isArray(dashboard.columnDividers)
    ? (dashboard.columnDividers as V1Divider[])
    : [];
  const rest = Object.fromEntries(
    Object.entries(dashboard).filter(
      ([key]) => key !== 'rowDividers' && key !== 'columnDividers',
    ),
  );
  return {
    ...rest,
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
 * project-wide), matching the runtime behavior of an empty registry. */
const migrations: Partial<Record<number, Migration>> = {
  // v1 -> v2: row/column groups replace dividers (spec.md C-14b).
  1: (data) => {
    const dashboards = Array.isArray(data.dashboards) ? data.dashboards : [];
    return {
      ...data,
      dashboards: dashboards.map((d: unknown) =>
        typeof d === 'object' && d !== null
          ? migrateDashboardDividersToGroups(d as Record<string, unknown>)
          : d,
      ),
    };
  },
};

function readVersion(input: unknown): number {
  if (
    typeof input === 'object' &&
    input !== null &&
    'schemaVersion' in input &&
    typeof input.schemaVersion === 'number'
  ) {
    return (input as { schemaVersion: number }).schemaVersion;
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
  let data: Record<string, unknown> =
    typeof input === 'object' && input !== null
      ? (input as Record<string, unknown>)
      : {};

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
