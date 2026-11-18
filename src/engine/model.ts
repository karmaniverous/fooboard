/**
 * The board model's shape (spec.md §3.1, Decision 6): the empty model,
 * with a battery slot for every GitHub token, grey until its first
 * response, and the model built from the derived rows and groups.
 *
 * @module
 */
import { unique } from 'radash';

import type { Dashboard } from '@/domain/config/dashboard';
import { rowCredentials } from '@/domain/settings/credentials';

import type { GroupEntry } from './groups';
import type { RowEntry } from './rowDerive';
import { type BoardModel, cellKey } from './types';

/** The GitHub tokens `dashboard`'s cells read with (a battery each). */
export const githubCredentialIds = (dashboard: Dashboard): string[] =>
  unique(
    dashboard.rows.flatMap((row) =>
      rowCredentials(dashboard, row, 'githubToken'),
    ),
  );

/** A model with nothing loaded yet: a budget slot (unknown so far) for
 * each GitHub token in `credentialIds`, so every battery shows at once. */
export const emptyModel = (
  credentialIds: readonly string[] = [],
): BoardModel => ({
  cells: {},
  unmapped: [],
  problems: [],
  amplifyBranches: [],
  amplifyKeyApps: {},
  budgets: Object.fromEntries(credentialIds.map((id) => [id, undefined])),
  refreshedAt: {},
});

/** The model the board shows: its derived `rows` and `groups`, and
 * the key apps and budgets beside them. */
export function buildModel(
  rows: ReadonlyMap<string, RowEntry>,
  groups: readonly GroupEntry[],
  extras: Pick<BoardModel, 'amplifyKeyApps' | 'budgets'>,
): BoardModel {
  const cells: BoardModel['cells'] = {};
  const refreshedAt: BoardModel['refreshedAt'] = {};
  for (const [rowId, entry] of rows) {
    for (const cell of entry.cells)
      cells[cellKey(cell.rowId, cell.stageId)] = cell;
    const at = entry.derivation.refreshedAt;
    if (at !== undefined) refreshedAt[rowId] = at;
  }
  // A run one token's cells place isn't unmapped because another
  // token's cells don't (spec.md §3.11).
  const mapped = new Set(groups.flatMap((g) => g.mapped));
  return {
    cells,
    refreshedAt,
    unmapped: unique(
      groups.flatMap((g) => g.unmapped),
      (u) => u.id,
    ).filter((u) => !mapped.has(u.id)),
    problems: unique(
      [
        ...[...rows.values()].flatMap((r) => r.derivation.problems),
        ...groups.flatMap((g) => g.problems),
      ],
      (p) => p.id,
    ),
    amplifyBranches: groups.flatMap((g) => g.branches),
    ...extras,
  };
}
