/**
 * Config migration entry point (spec.md C-2, §5: "config schema bumps ship
 * with an import migration"). Applies any migrations needed to bring
 * arbitrary stored or imported data up to `CURRENT_SCHEMA_VERSION`, then
 * validates it against `ConfigRootSchema`.
 *
 * The chain starts at version 4 (spec.md §3.3 *Data model version*):
 * earlier development versions are refused. v4 → v5 adds each
 * dashboard's `settings` (requests in flight) with their defaults.
 * Steps are pure and idempotent.
 *
 * @module
 */
import { z } from 'zod';

import type { ConfigRoot } from './root';
import { ConfigRootSchema, CURRENT_SCHEMA_VERSION } from './root';
import { defaultSettings } from './settings';

/** The refusal for a configuration from a newer data model (spec.md
 * A§4.3.7): never guessed at. */
const NEWER_VERSION_MESSAGE = 'made with a newer fooboard; reload to update';

type Migration = (input: Record<string, unknown>) => Record<string, unknown>;

/** The first version the chain starts from (spec.md A§4.3.7): earlier
 * development versions were never saved and are not migrated. */
export const FIRST_VERSION = 4;

/** A dashboard list as stored: absent means none. */
const DashboardListSchema = z
  .array(z.record(z.string(), z.unknown()))
  .optional();

/** v4 → v5: every dashboard gains `settings` with the defaults (a
 * dashboard that has them keeps its own). A malformed list is left as it
 * is, so validation refuses it and the store keeps it read-only rather
 * than saving an empty configuration over it. */
export const addSettings: Migration = (input) => {
  const list = DashboardListSchema.safeParse(input.dashboards);
  if (!list.success) return input;
  return {
    ...input,
    dashboards: (list.data ?? []).map((d) => ({
      settings: defaultSettings(),
      ...d,
    })),
  };
};

/** Migration from each version to the next; a release that changes the
 * data model adds one. */
const migrations: Partial<Record<number, Migration>> = {
  [FIRST_VERSION]: addSettings,
};

/** The data model version `input` says it was written with (0: none). */
export function readVersion(input: unknown): number {
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
export function migrate(
  input: unknown,
  steps: Partial<Record<number, Migration>> = migrations,
  first: number = FIRST_VERSION,
): ConfigRoot {
  let version = readVersion(input);
  let data: Record<string, unknown> = z
    .record(z.string(), z.unknown())
    .catch({})
    .parse(input);

  if (version > CURRENT_SCHEMA_VERSION) {
    throw new Error(NEWER_VERSION_MESSAGE);
  }

  if (version < first) {
    throw new Error(
      `schema version ${String(version)} is from an early development build and can't be opened`,
    );
  }
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = steps[version];
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
