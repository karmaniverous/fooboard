/**
 * The instrumentation hook (spec.md §3.5, Decision 9): every request the
 * query layer sends runs through an `Around`, which may time it or delay
 * it without changing what it returns. Development builds use it for the
 * timing session and the demo's simulated latency; production passes
 * requests straight through. A request is one HTTP call (one query).
 *
 * @module
 */
import type { Provider } from '@/domain/config/providers';

import type { FooboardQueryKey } from './keys';

/** What a request reads, enough to name it and find the rows needing it. */
export interface RequestCall {
  provider: Provider;
  /** The call, e.g. `runs`, `jobs`, `compare`, `branches`. */
  kind: string;
  credentialId: string;
  /** GitHub: the repo read (`owner/name`); none for account-wide reads. */
  repo?: string;
  /** Amplify: the region and app read. */
  region?: string;
  appId?: string;
}

/** Runs one request: call `run` (once) and settle as it does. */
export type Around = <T>(
  call: RequestCall,
  run: () => Promise<T>,
) => Promise<T>;

/** No instrumentation. */
export const passThrough: Around = (_call, run) => run();

/** The request a query key makes. */
export function requestCall([
  provider,
  credentialId,
  request,
]: FooboardQueryKey): RequestCall {
  return {
    provider,
    kind: request.call,
    credentialId,
    ...('repo' in request ? { repo: request.repo } : {}),
    ...('region' in request ? { region: request.region } : {}),
    ...('appId' in request ? { appId: request.appId } : {}),
  };
}
