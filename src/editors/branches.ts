/**
 * Branch discovery for the editors (spec.md C-21): branch names per repo,
 * each read with the row's own GitHub token (C-1a) through the board's
 * queries (spec.md §3.1), and what they show:
 * how many repos have each branch, and what a pattern would match.
 *
 * @module
 */
import { unique } from 'radash';

import type { Dashboard } from '@/domain/config/dashboard';
import { rowGithubCredentialId } from '@/domain/config/inheritance';
import type { Row } from '@/domain/config/row';
import { matchesBranchPattern } from '@/domain/matching';
import type { QueryEnv } from '@/query/client';
import { fetchBranches } from '@/query/lookups';

/** Branch names per repo for `rows` (default: every row). A row without
 * a repo (an Amplify app with none), or whose repo's row has no usable
 * token, is skipped; a read failure rejects. */
export async function discoverBranches(
  dashboard: Dashboard,
  env: Pick<QueryEnv, 'client' | 'providers'>,
  rows: readonly Row[] = dashboard.rows,
): Promise<Map<string, string[]>> {
  const byRepo = new Map<string, string[]>();
  for (const row of rows) {
    const { repo } = row;
    if (repo === undefined || byRepo.has(repo)) continue;
    const id = rowGithubCredentialId(dashboard, row);
    if (!id || !env.providers.github(id)) continue;
    const branches = await fetchBranches(env.client, id, repo);
    byRepo.set(
      repo,
      branches.map((b) => b.name),
    );
  }
  return byRepo;
}
/** Branches found across repos, with how many repos have each, most
 * common first (spec.md C-21: `main` 19/19, `release/24.3` 17/19). */
export function branchCounts(
  branchesByRepo: ReadonlyMap<string, readonly string[]>,
): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const branches of branchesByRepo.values()) {
    for (const name of unique(branches)) {
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
  }
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** What a pattern would match: the repos with at least one matching
 * branch, and every matching branch name. */
export function patternPreview(
  pattern: string,
  branchesByRepo: ReadonlyMap<string, readonly string[]>,
): { repos: string[]; branches: string[] } {
  const repos: string[] = [];
  const branches = new Set<string>();
  if (!pattern.trim()) return { repos, branches: [] };
  for (const [repo, names] of branchesByRepo) {
    const hits = names.filter((b) => matchesBranchPattern(pattern, b));
    if (hits.length > 0) repos.push(repo);
    hits.forEach((b) => branches.add(b));
  }
  return { repos, branches: [...branches].sort() };
}
