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

/** Where a request waits in its credential's queue (Decision 29 item 7):
 * root queries and editor lookups go ahead of jobs and compares. */
export type Priority = 'root' | 'dependent';

export const priorityOf = (key: FooboardQueryKey): Priority =>
  key[0] === 'github' && (key[2].call === 'jobs' || key[2].call === 'compare')
    ? 'dependent'
    : 'root';

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
