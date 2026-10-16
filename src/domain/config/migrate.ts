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

/** Migrations keyed by the version they migrate *from*. `Partial` so a
 * missing step types as `undefined` (there is no `noUncheckedIndexedAccess`
 * project-wide), matching the runtime behavior of an empty registry. */
const migrations: Partial<Record<number, Migration>> = {};

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
    data = step(data);
    version += 1;
  }

  return ConfigRootSchema.parse(data);
}
