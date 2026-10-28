/**
 * Which queries the app keeps at rest (spec.md §3.4, Decision 27): a
 * board's reads (root and dependent queries) made with the secret this
 * device remembers for the credential. Editor lookups stay in memory; a
 * session-only credential's data is never kept, so it can't outlive the
 * tab the user chose to keep its secret in; nor is data read with any
 * other secret than the remembered one (a session-only secret in a tab
 * where another tab remembered a different one under the same id, or a
 * secret since replaced). The test is by fingerprint, never the secret
 * (`fingerprintOf`). The query's success is the persister's test, not
 * this one's.
 *
 * @module
 */
import type { QueryKey } from '@tanstack/query-core';

import { QueryKeySchema, roleOf } from '@/query/keys';

/** May a query be kept at rest, given the fingerprint of the secret its
 * data was read with? */
export type Keeps = (
  queryKey: QueryKey,
  readWith: string | undefined,
) => boolean;

/** The rule for a device whose remembered secrets' fingerprints
 * `rememberedFingerprint` gives. */
export const keepsQuery =
  (
    rememberedFingerprint: (credentialId: string) => string | undefined,
  ): Keeps =>
  (queryKey, readWith) => {
    const key = QueryKeySchema.safeParse(queryKey);
    return (
      key.success &&
      roleOf(key.data) !== 'lookup' &&
      readWith !== undefined &&
      readWith === rememberedFingerprint(key.data[1])
    );
  };
