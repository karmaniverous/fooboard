/**
 * The board model's starting point (spec.md §3.1, Decision 6): the empty
 * model, with a battery slot for every GitHub token, grey until its
 * first response.
 *
 * @module
 */
import { unique } from 'radash';

import type { Dashboard } from '@/domain/config/dashboard';
import { rowCredentials } from '@/domain/settings/credentials';

import type { BoardModel } from './types';

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
  budgets: Object.fromEntries(credentialIds.map((id) => [id, undefined])),
  refreshedAt: {},
});
