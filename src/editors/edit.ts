/**
 * Pure editing helpers (spec.md C-21): reordering, unique ids, rows from
 * picked repos, duplicating a dashboard, and the branch discovery that
 * seeds new stages (branch counts and pattern previews).
 *
 * @module
 */
import { unique } from 'radash';

import { mapCredentialRefs } from '@/credentials/dashboardCredentials';
import type { Dashboard } from '@/domain/config/dashboard';
import type { Divider } from '@/domain/config/dividers';
import type { GithubRow } from '@/domain/config/row';
import { matchesBranchPattern } from '@/domain/matching';

/** Move the item at `index` by `delta` places (keyboard reordering). */
export function moveItem<T>(
  list: readonly T[],
  index: number,
  delta: number,
): T[] {
  const to = index + delta;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) {
    return [...list];
  }
  const next = [...list];
  const [item] = next.splice(index, 1);
  next.splice(to, 0, item);
  return next;
}

/** A readable id from `base`, made unique among `taken`. */
export function uniqueId(base: string, taken: Iterable<string>): string {
  const slug =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'item';
  const used = new Set(taken);
  if (!used.has(slug)) return slug;
  let n = 2;
  while (used.has(`${slug}-${String(n)}`)) n++;
  return `${slug}-${String(n)}`;
}

/** A GitHub row for a picked repo: the display name defaults to the repo
 * name without its owner (spec.md C-21). */
export function rowFromRepo(
  fullName: string,
  dashboard: Pick<Dashboard, 'rows'>,
): GithubRow {
  const name = fullName.split('/')[1] ?? fullName;
  return {
    type: 'github',
    id: uniqueId(
      name,
      dashboard.rows.map((r) => r.id),
    ),
    repo: fullName,
    displayName: name,
    rowKeyTests: [],
  };
}

/** A copy under a new id and name. Credentials are re-keyed by `newId`
 * so the copy's secrets are independent (the caller copies them). */
export function duplicateDashboard(
  dashboard: Dashboard,
  id: string,
  name: string,
  newCredentialId: (oldId: string) => string,
): Dashboard {
  const ids = new Map(
    dashboard.credentials.map((c) => [c.id, newCredentialId(c.id)]),
  );
  return {
    ...mapCredentialRefs(structuredClone(dashboard), (ref) => ids.get(ref)),
    id,
    name,
    credentials: dashboard.credentials.map((c) => ({
      ...c,
      id: ids.get(c.id) ?? c.id,
    })),
  };
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

/** `owner/name` from an Amplify app's repository URL, if it is GitHub. */
export function repoFromUrl(url: string | undefined): string | undefined {
  const match =
    /^https:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(
      url ?? '',
    );
  return match ? `${match[1]}/${match[2]}` : undefined;
}

/** Remove a row, and the divider attached to it. */
export function removeRow(dashboard: Dashboard, id: string): Dashboard {
  return {
    ...dashboard,
    rows: dashboard.rows.filter((r) => r.id !== id),
    rowDividers: dashboard.rowDividers.filter((d) => d.beforeId !== id),
  };
}

/** Remove a stage, its divider, and any stage's use of it as a source. */
export function removeStage(dashboard: Dashboard, id: string): Dashboard {
  return {
    ...dashboard,
    stages: dashboard.stages
      .filter((s) => s.id !== id)
      .map((s) =>
        s.sourceStageId === id ? { ...s, sourceStageId: undefined } : s,
      ),
    columnDividers: dashboard.columnDividers.filter((d) => d.beforeId !== id),
  };
}

/** Set (or, with `undefined`, clear) the divider before `beforeId`. */
export function setDivider(
  dividers: readonly Divider[],
  beforeId: string,
  divider: Omit<Divider, 'beforeId'> | undefined,
): Divider[] {
  const rest = dividers.filter((d) => d.beforeId !== beforeId);
  return divider ? [...rest, { ...divider, beforeId }] : rest;
}
