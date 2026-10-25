/**
 * The query function behind every key (spec.md §3.1, Decision 5): reads
 * the key back, waits for a slot in the credential's limiter (editor
 * lookups and a root read's first load ahead of everything else, Decision
 * 45), and makes the one request the key names through the
 * instrumentation hook. GitHub requests are conditional on the ETag kept
 * with the cached data, so a `304` returns that data unchanged; a first
 * page that lands with new data refetches its list's later pages. A rate
 * limit or throttle pauses the credential's limiter until its retry time.
 *
 * @module
 */
import type { QueryClient, QueryFunction } from '@tanstack/query-core';

import { AmplifyThrottledError } from '@/lib/amplify/errors';
import { listRegion } from '@/lib/amplify/regions';
import type { AmplifyReaderFor } from '@/lib/amplify/rowJobs';
import {
  type Conditional,
  type Fetched,
  type GitHubApi,
  RateLimitedError,
  repoRef,
} from '@/lib/github';

import { type Around, requestCall } from './instrument';
import {
  type AmplifyQueryKey,
  type GithubQueryKey,
  isLaterPage,
  priorityOf,
  QueryKeySchema,
} from './keys';
import type { Limiters } from './limiters';
import type { ReadWith } from './readWith';

/** Readers for the credentials one QueryClient serves; `undefined` means
 * no secret is entered (the board shows *needs credential*). */
export interface QueryProviders {
  github(credentialId: string): GitHubApi | undefined;
  amplify(credentialId: string): AmplifyReaderFor | undefined;
  /** Changes whenever the credential's secret does. */
  fingerprint(credentialId: string): string | undefined;
}

/** A request for a credential with no secret entered. */
export class MissingCredentialError extends Error {
  constructor(credentialId: string) {
    super(`no secret entered for credential ${credentialId}`);
    this.name = 'MissingCredentialError';
  }
}

/** What the query function needs. */
export interface FetchEnv {
  providers: QueryProviders;
  limiters: Limiters;
  now: () => number;
  around: () => Around;
  /** Where each answer's secret is noted (Decision 27). */
  readWith: ReadWith;
}

/** An answer without an ETag or pages (Amplify). */
const plain = <T>(data: T): Fetched<T> => ({
  notModified: false,
  data,
  etag: null,
  hasNext: false,
  redirected: false,
});

/** Send `call` conditional on the cached ETag; a 304 keeps the cache. */
async function conditional<T>(
  client: QueryClient,
  key: GithubQueryKey,
  call: (etag: string | null | undefined) => Promise<Conditional<T>>,
): Promise<Fetched<T>> {
  const previous = client.getQueryData<Fetched<T>>(key);
  const res = await call(previous?.etag);
  if (!res.notModified) {
    const request = key[2];
    if (previous && 'page' in request && request.page === 1)
      client.invalidateQueries({
        predicate: (q) => {
          const other = QueryKeySchema.safeParse(q.queryKey);
          return other.success && isLaterPage(key, other.data);
        },
      });
    return res;
  }
  if (!previous) throw new Error(`304 without cached data: ${key[2].call}`);
  return previous;
}

function fetchGithub(
  api: GitHubApi,
  client: QueryClient,
  key: GithubQueryKey,
): Promise<Fetched<unknown>> {
  const request = key[2];
  switch (request.call) {
    case 'runs':
      return conditional(client, key, (etag) =>
        api.runsPage(repoRef(request.repo), request.page, etag),
      );
    case 'jobs':
      return conditional(client, key, (etag) =>
        api.jobsPage(
          repoRef(request.repo),
          request.runId,
          request.attempt,
          request.page,
          etag,
        ),
      );
    case 'compare':
      return conditional(client, key, (etag) =>
        api.compare(repoRef(request.repo), request.base, request.head, etag),
      );
    case 'branches':
      return conditional(client, key, (etag) =>
        api.branchesPage(repoRef(request.repo), request.page, etag),
      );
    case 'repos':
      return conditional(client, key, (etag) =>
        api.reposPage(request.page, etag),
      );
  }
}

async function fetchAmplify(
  readerFor: AmplifyReaderFor,
  [, credentialId, request]: AmplifyQueryKey,
): Promise<Fetched<unknown>> {
  const reader = readerFor({ credentialId, region: request.region });
  switch (request.call) {
    case 'branches':
      return plain(await reader.listBranches(request.appId));
    case 'jobs':
      return plain(
        await reader.listJobs(request.appId, request.branch, request.max),
      );
    case 'apps':
      // A region the skip rules skip is an answer, not a failure (§3.12).
      return plain(await listRegion(request.region, () => reader.listApps()));
  }
}

/** The default query function for a QueryClient serving `env`. */
export function createQueryFn(env: FetchEnv): QueryFunction {
  return ({ queryKey, client }) => {
    const key = QueryKeySchema.parse(queryKey);
    const [provider, credentialId] = key;
    const limiter = env.limiters.for(provider, credentialId);
    const query = client.getQueryCache().find({ queryKey: key, exact: true });
    const read = (): Promise<Fetched<unknown>> => {
      if (key[0] === 'github') {
        const api = env.providers.github(credentialId);
        if (!api) throw new MissingCredentialError(credentialId);
        return fetchGithub(api, client, key);
      }
      const readerFor = env.providers.amplify(credentialId);
      if (!readerFor) throw new MissingCredentialError(credentialId);
      return fetchAmplify(readerFor, key);
    };
    /** Read, noting the secret the reader was built from as it lands. */
    const send = async (): Promise<Fetched<unknown>> => {
      const fingerprint = env.providers.fingerprint(credentialId);
      const answer = await read();
      if (query && fingerprint !== undefined)
        env.readWith.note(query, fingerprint);
      return answer;
    };
    const cached = client.getQueryData(key) !== undefined;
    return limiter.run(priorityOf(key, cached), async () => {
      try {
        return await env.around()(requestCall(key), send);
      } catch (err) {
        // Pause before the slot frees, so nothing queued slips through.
        if (err instanceof RateLimitedError) limiter.pauseUntil(err.retryAt);
        if (err instanceof AmplifyThrottledError)
          limiter.pauseUntil(env.now() + err.retryAfterMs);
        throw err;
      }
    });
  };
}
