/**
 * Typed reads of the query cache (spec.md §3.1): what each request's
 * query holds once it lands, and a snapshot of one query's state, so the
 * board model derives from the cache without awaiting anything. The data
 * types follow the keys: the query function stores what each call
 * returns.
 *
 * @module
 */
import type {
  App,
  Branch as AmplifyBranch,
  JobSummary,
} from '@aws-sdk/client-amplify';
import type { QueryClient } from '@tanstack/query-core';

import type {
  Branch,
  CompareApiResult,
  Fetched,
  Job,
  Repo,
  WorkflowRun,
} from '@/lib/github';

import {
  amplifyKey,
  type AmplifyRequest,
  githubKey,
  type GithubRequest,
} from './keys';

/** What each GitHub call's query holds. */
export interface GithubData {
  runs: Fetched<WorkflowRun[]>;
  jobs: Fetched<Job[]>;
  compare: Fetched<CompareApiResult>;
  branches: Fetched<Branch[]>;
  repos: Fetched<Repo[]>;
}

/** What each Amplify call's query holds. */
export interface AmplifyData {
  branches: Fetched<AmplifyBranch[]>;
  jobs: Fetched<JobSummary[]>;
  apps: Fetched<App[]>;
}

/** `Snapshot.updatedAt` for a query whose data never landed. */
export const NEVER_UPDATED = 0;

/** One query as the board model sees it. */
export interface Snapshot<T> {
  data: T | undefined;
  error: unknown;
  /** The latest fetch failed (data, if any, is from before). */
  failed: boolean;
  /** When the data last landed (ms; `NEVER_UPDATED` when never). */
  updatedAt: number;
  /** A fetch is under way, or waiting for the network. */
  fetching: boolean;
  /** The query's hash, which keys what the board model tracks of it. */
  queryHash: string;
}

const EMPTY: Omit<Snapshot<never>, 'queryHash'> = {
  data: undefined,
  error: null,
  failed: false,
  updatedAt: NEVER_UPDATED,
  fetching: false,
};

function snapshot<T>(
  client: QueryClient,
  key: readonly unknown[],
): Snapshot<T> {
  const { queryHash } = client.defaultQueryOptions({ queryKey: key });
  const state = client.getQueryCache().get<T>(queryHash)?.state;
  if (!state) return { ...EMPTY, queryHash };
  return {
    queryHash,
    data: state.data,
    error: state.error,
    failed: state.status === 'error',
    updatedAt: state.dataUpdatedAt,
    fetching: state.fetchStatus !== 'idle',
  };
}

/** A GitHub query's snapshot. */
export const githubSnapshot = <R extends GithubRequest>(
  client: QueryClient,
  credentialId: string,
  request: R,
): Snapshot<GithubData[R['call']]> =>
  snapshot(client, githubKey(credentialId, request));

/** An Amplify query's snapshot. */
export const amplifySnapshot = <R extends AmplifyRequest>(
  client: QueryClient,
  credentialId: string,
  request: R,
): Snapshot<AmplifyData[R['call']]> =>
  snapshot(client, amplifyKey(credentialId, request));
