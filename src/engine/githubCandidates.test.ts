/**
 * Tests for a GitHub row's candidate runs (spec.md §3.1): runs read across
 * pages are de-duplicated by run id, so a run pushed onto the next page by
 * a newer one is neither doubled nor allowed to push another run out of
 * the window; the window reports whether it filled.
 *
 * @module
 */
import { QueryClient } from '@tanstack/query-core';
import { describe, expect, it } from 'vitest';

import { fetched } from '@/test/fakeReaders';
import { demoContext, demoRuns } from '@/test/githubCache';

import { githubCandidates } from './githubCandidates';

const REPO = 'acme/api-core';
const source = () => demoContext(new QueryClient(), REPO).source;
const ids = (out: ReturnType<typeof githubCandidates>) =>
  out.candidates.map((c) => c.run.id).sort((a, b) => a - b);

describe('githubCandidates', () => {
  it('keeps each run once when pages overlap at their boundary', async () => {
    const runs = await demoRuns(REPO);
    const cut = Math.floor(runs.length / 2);
    // A new run shifted the list: page 2 starts with page 1's last run.
    const pages = [
      fetched(runs.slice(0, cut), { hasNext: true }),
      fetched(runs.slice(cut - 1)),
    ];
    const out = githubCandidates(source(), pages);
    expect(ids(out)).toEqual([...new Set(ids(out))]);
    expect(ids(out)).toEqual(ids(githubCandidates(source(), [fetched(runs)])));
  });

  it('fills the window with distinct runs, never losing one to a duplicate', async () => {
    const runs = await demoRuns(REPO);
    const base = source();
    const narrow = {
      ...base,
      reader: { ...base.reader, runs: 3, excludePullRequests: false },
      keep: { combine: 'and' as const, checks: [] },
    };
    const [first, second, third] = runs;
    const out = githubCandidates(narrow, [
      fetched([first, second], { hasNext: true }),
      fetched([second, third]),
    ]);
    expect(ids(out)).toEqual(
      [first.id, second.id, third.id].sort((a, b) => a - b),
    );
    expect(out.full).toBe(true);
    expect(githubCandidates(narrow, [fetched([first])]).full).toBe(false);
  });
});
