/**
 * Which queries the app keeps at rest (spec.md §3.4, Decision 27): a
 * board's reads (root and dependent queries) of a credential whose secret
 * is remembered on this device. Editor lookups stay in memory, and a
 * session-only credential's data is never kept, so it can't outlive the
 * tab the user chose to keep its secret in. The query's success is the
 * persister's test, not this one's.
 *
 * @module
 */
import type { QueryKey } from '@tanstack/query-core';

import { QueryKeySchema, roleOf } from '@/query/keys';

/** The rule for a device whose remembered credentials `isRemembered`
 * names. */
export const keepsQuery =
  (isRemembered: (credentialId: string) => boolean) =>
  (queryKey: QueryKey): boolean => {
    const key = QueryKeySchema.safeParse(queryKey);
    return (
      key.success && roleOf(key.data) !== 'lookup' && isRemembered(key.data[1])
    );
  };
