/**
 * Which secret each query's data was read with (spec.md §3.4, Decision
 * 27): the query function notes the fingerprint of the secret it sent the
 * request with as the answer lands, and a restored query gets the
 * fingerprint stored with it. Only data read with the credential's
 * remembered secret may be kept at rest, so a session-only secret's data
 * (in a tab where another tab remembered a different secret under the
 * same id) and an old secret's data (written just before the secret was
 * replaced) can't be persisted or restored.
 *
 * @module
 */
import type { Query } from '@tanstack/query-core';

export interface ReadWith {
  /** The fingerprint of the secret `query`'s data was read with. */
  of(query: Query): string | undefined;
  /** `query`'s data was read with the secret whose fingerprint is
   * `fingerprint`. */
  note(query: Query, fingerprint: string): void;
}

/** A register held per query object, so a removed query takes its entry
 * with it. */
export function createReadWith(): ReadWith {
  const fingerprints = new WeakMap<Query, string>();
  return {
    of: (query) => fingerprints.get(query),
    note(query, fingerprint) {
      fingerprints.set(query, fingerprint);
    },
  };
}
