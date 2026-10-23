/**
 * Query keys (spec.md §3.1, Decision 2): one query per request, keyed
 * `[provider, credentialId, request]`, where `request` names the call and
 * its parameters. Every paginated GitHub list carries a page part; the
 * Amplify jobs key's `max` bounds its read instead. Keys hold credential
 * ids, never secrets. The schema lets the query function read a key back
 * without casts.
 *
 * @module
 */
import { isEqual } from 'radash';
import { z } from 'zod';

const repo = z.string();
const page = z.number().int().positive();

/** GitHub requests by call. */
const GithubRequestSchema = z.discriminatedUnion('call', [
  z.object({ call: z.literal('runs'), repo, page }),
  z.object({
    call: z.literal('jobs'),
    repo,
    runId: z.number(),
    attempt: z.number(),
    page,
  }),
  z.object({
    call: z.literal('compare'),
    repo,
    base: z.string(),
    head: z.string(),
  }),
  z.object({ call: z.literal('branches'), repo, page }),
  z.object({ call: z.literal('repos'), page }),
]);
export type GithubRequest = z.infer<typeof GithubRequestSchema>;

/** Amplify requests by call. */
const AmplifyRequestSchema = z.discriminatedUnion('call', [
  z.object({
    call: z.literal('branches'),
    region: z.string(),
    appId: z.string(),
  }),
  z.object({
    call: z.literal('jobs'),
    region: z.string(),
    appId: z.string(),
    branch: z.string(),
    max: z.number().int().positive(),
  }),
  z.object({ call: z.literal('apps'), region: z.string() }),
]);
export type AmplifyRequest = z.infer<typeof AmplifyRequestSchema>;

/** Every query key fooboard makes. */
export const QueryKeySchema = z.union([
  z.tuple([z.literal('github'), z.string(), GithubRequestSchema]),
  z.tuple([z.literal('amplify'), z.string(), AmplifyRequestSchema]),
]);
export type FooboardQueryKey = z.infer<typeof QueryKeySchema>;
export type GithubQueryKey = ['github', string, GithubRequest];
export type AmplifyQueryKey = ['amplify', string, AmplifyRequest];

export const githubKey = (
  credentialId: string,
  request: GithubRequest,
): GithubQueryKey => ['github', credentialId, request];

export const amplifyKey = (
  credentialId: string,
  request: AmplifyRequest,
): AmplifyQueryKey => ['amplify', credentialId, request];

/** The prefix matching every query of one credential (removals). */
export const credentialPrefix = (
  provider: FooboardQueryKey[0],
  credentialId: string,
): [string, string] => [provider, credentialId];

/** What a request is for: an editor lookup (repos, a repo's branches,
 * Amplify apps), a row's root read (runs pages, an app's branches and
 * jobs), or a read that depends on one (a run's jobs, a compare). */
export type RequestRole = 'lookup' | 'root' | 'dependent';

export function roleOf(key: FooboardQueryKey): RequestRole {
  if (key[0] === 'amplify') return key[2].call === 'apps' ? 'lookup' : 'root';
  switch (key[2].call) {
    case 'repos':
    case 'branches':
      return 'lookup';
    case 'runs':
      return 'root';
    case 'jobs':
    case 'compare':
      return 'dependent';
  }
}

/** Where a request waits in its credential's queue (Decision 29 item 7,
 * Decision 45 item 3): editor lookups, and a root read's first load (no
 * data cached yet), go to the front; a root read's later polls wait in
 * line with jobs and compares. */
export type Priority = 'high' | 'normal';

export function priorityOf(key: FooboardQueryKey, cached: boolean): Priority {
  const role = roleOf(key);
  return role === 'lookup' || (role === 'root' && !cached) ? 'high' : 'normal';
}

/** A paginated request's page, if it has one. */
const pageOf = (request: GithubRequest): number | undefined =>
  'page' in request ? request.page : undefined;

/** Is `other` a later page of the same list as `first` (same credential,
 * call and parameters, page \> 1)? Used to refetch a list's later pages
 * when its first page lands with new data (§3.1). */
export function isLaterPage(
  first: GithubQueryKey,
  other: FooboardQueryKey,
): boolean {
  if (other[0] !== 'github' || other[1] !== first[1]) return false;
  const a = first[2];
  const b = other[2];
  const laterPage = pageOf(b);
  if (a.call !== b.call || laterPage === undefined || laterPage <= 1)
    return false;
  return isEqual({ ...a, page: 0 }, { ...b, page: 0 });
}
