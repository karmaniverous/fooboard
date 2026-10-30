/**
 * Poll a board's root queries now: when a board opens (spec 0.2.0 §3.J
 * *Batteries and the first poll*, Decision 109), so a restored answer
 * younger than its interval doesn't wait out the interval, and on a
 * click's boost (§3.H). A fetch already running counts as the poll (it
 * isn't cancelled and restarted), so a first visit's mount fetch isn't
 * doubled, and each request still goes through its credential's limiter,
 * so a rate-limited token waits.
 *
 * @module
 */
import type { QueryClient } from '@tanstack/query-core';

import type { Need } from './need';

/** Read each of `needs`' root queries now. */
export function pollRootsNow(
  client: QueryClient,
  needs: readonly Need[],
): void {
  for (const { key } of needs.filter((need) => need.root))
    // refetchQueries reports failures through the query, never by
    // rejecting; the catch only satisfies the type.
    client
      .refetchQueries({ queryKey: key, exact: true }, { cancelRefetch: false })
      .catch(() => undefined);
}
