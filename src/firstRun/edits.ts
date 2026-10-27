/**
 * The first run's changes to the new dashboard (spec.md §3.9): its rows
 * from the repos ticked, and its stages from the preset chosen, each
 * replacing what an earlier visit to the step made. Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import { removeRow, removeStage, rowFromRepo } from '@/editors/edit';

/** The GitHub repos `dashboard` has rows for. */
export const reposOf = (dashboard: Dashboard): string[] =>
  dashboard.rows.flatMap((r) => (r.type === 'github' ? [r.repo] : []));

/** `dashboard` with a row for each of `chosen` (in `order`), and none for
 * a GitHub repo not chosen. */
export function withRepos(
  dashboard: Dashboard,
  chosen: ReadonlySet<string>,
  order: readonly string[],
): Dashboard {
  const dropped = dashboard.rows
    .filter((r) => r.type === 'github' && !chosen.has(r.repo))
    .reduce((d, r) => removeRow(d, r.id), dashboard);
  const have = new Set(reposOf(dropped));
  return order
    .filter((repo) => chosen.has(repo) && !have.has(repo))
    .reduce(
      (d, repo) => ({ ...d, rows: [...d.rows, rowFromRepo(repo, d)] }),
      dropped,
    );
}

/** `dashboard` with `stages` in place of its own (and of everything
 * keyed by them). */
export const withStages = (
  dashboard: Dashboard,
  stages: Dashboard['stages'],
): Dashboard => ({
  ...dashboard.stages.reduce((d, s) => removeStage(d, s.id), dashboard),
  stages,
});
