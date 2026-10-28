/**
 * Tests for the query keys (spec.md §3.1): one key per request, GitHub
 * jobs keyed by run attempt so a re-run reads its own jobs, a page part on
 * every paginated key, later pages of the same list recognised, the two
 * limiter priorities, and keys read back by the query function.
 *
 * @module
 */
import { hashKey } from '@tanstack/query-core';
import { describe, expect, it } from 'vitest';

import {
  amplifyKey,
  credentialPrefix,
  githubKey,
  isLaterPage,
  priorityOf,
  QueryKeySchema,
  roleOf,
} from './keys';

const REPO = 'acme/api';
const jobs = (attempt: number, page = 1) =>
  githubKey('gh', { call: 'jobs', repo: REPO, runId: 7, attempt, page });

describe('query keys', () => {
  it('gives every request its own key, a re-run attempt included', () => {
    const keys = [
      githubKey('gh', { call: 'runs', repo: REPO, page: 1 }),
      githubKey('gh', { call: 'runs', repo: REPO, page: 2 }),
      githubKey('other', { call: 'runs', repo: REPO, page: 1 }),
      jobs(1),
      jobs(2),
      githubKey('gh', { call: 'compare', repo: REPO, base: 'a', head: 'b' }),
      githubKey('gh', { call: 'compare', repo: REPO, base: 'b', head: 'a' }),
      githubKey('gh', { call: 'branches', repo: REPO, page: 1 }),
      githubKey('gh', { call: 'repos', page: 1 }),
      amplifyKey('aws', { call: 'branches', region: 'eu', appId: 'a' }),
      amplifyKey('aws', { call: 'apps', region: 'eu' }),
      amplifyKey('aws', {
        call: 'jobs',
        region: 'eu',
        appId: 'a',
        branch: 'main',
        max: 5,
      }),
    ];
    expect(new Set(keys.map((k) => hashKey(k))).size).toBe(keys.length);
  });

  it('reads a key back, refusing one that is not a request', () => {
    expect(QueryKeySchema.parse(jobs(2))).toEqual(jobs(2));
    expect(QueryKeySchema.safeParse(jobs(1, 0)).success).toBe(false);
    expect(QueryKeySchema.safeParse(['github', 'gh']).success).toBe(false);
  });

  it('names each request a lookup, a root read or a dependent read', () => {
    expect(roleOf(jobs(1))).toBe('dependent');
    expect(
      roleOf(
        githubKey('gh', { call: 'compare', repo: REPO, base: 'a', head: 'b' }),
      ),
    ).toBe('dependent');
    expect(roleOf(githubKey('gh', { call: 'runs', repo: REPO, page: 1 }))).toBe(
      'root',
    );
    expect(
      roleOf(amplifyKey('aws', { call: 'branches', region: 'eu', appId: 'a' })),
    ).toBe('root');
    expect(roleOf(githubKey('gh', { call: 'repos', page: 1 }))).toBe('lookup');
    expect(
      roleOf(githubKey('gh', { call: 'branches', repo: REPO, page: 1 })),
    ).toBe('lookup');
    // The app search's queries are board queries (spec.md §3.12).
    expect(roleOf(amplifyKey('aws', { call: 'apps', region: 'eu' }))).toBe(
      'root',
    );
  });

  it('puts lookups and first loads of root reads ahead (Decision 45)', () => {
    const runs = githubKey('gh', { call: 'runs', repo: REPO, page: 1 });
    const apps = amplifyKey('aws', { call: 'apps', region: 'eu' });
    expect(priorityOf(runs, false)).toBe('high');
    expect(priorityOf(runs, true)).toBe('normal');
    expect(priorityOf(apps, false)).toBe('high');
    expect(priorityOf(apps, true)).toBe('normal');
    expect(priorityOf(jobs(1), false)).toBe('normal');
  });

  it('recognises later pages of the same list and credential only', () => {
    const first = githubKey('gh', { call: 'runs', repo: REPO, page: 1 });
    const page = (p: number, repo = REPO, credential = 'gh') =>
      githubKey(credential, { call: 'runs', repo, page: p });
    expect(isLaterPage(first, page(2))).toBe(true);
    expect(isLaterPage(first, page(5))).toBe(true);
    expect(isLaterPage(first, page(1))).toBe(false);
    expect(isLaterPage(first, page(2, 'acme/web'))).toBe(false);
    expect(isLaterPage(first, page(2, REPO, 'other'))).toBe(false);
    expect(isLaterPage(first, jobs(1, 2))).toBe(false);
    expect(
      isLaterPage(first, amplifyKey('gh', { call: 'apps', region: 'eu' })),
    ).toBe(false);
    expect(isLaterPage(jobs(1), jobs(1, 2))).toBe(true);
    expect(isLaterPage(jobs(1), jobs(2, 2))).toBe(false);
  });

  it('prefixes every key of a credential, per provider', () => {
    const prefix = credentialPrefix('github', 'gh');
    expect(jobs(1).slice(0, 2)).toEqual(prefix);
    expect(credentialPrefix('amplify', 'gh')).not.toEqual(prefix);
  });
});
