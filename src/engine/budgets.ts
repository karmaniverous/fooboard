/**
 * Every GitHub token's budget from the start (spec.md C-16): the tokens a
 * dashboard uses, and a poll target per token that reads GitHub's
 * `rate_limit` endpoint (free: it does not count against the limit) on
 * opening and then at most every `BUDGET_READ_MS`. Ordinary responses keep
 * the budgets current in between.
 *
 * @module
 */
import { unique } from 'radash';

import type { Dashboard } from '@/domain/config/dashboard';
import { rowGithubCredentialId } from '@/domain/config/inheritance';
import type { GitHubReader, RateLimitBudget } from '@/lib/github';

import type { PollTarget } from './scheduler';

/** How often a token's budget is re-read from `rate_limit`. */
export const BUDGET_READ_MS = 5 * 60_000;

/** The ids of the GitHub tokens a dashboard reads with, in row order. */
export const githubCredentialIds = (dashboard: Dashboard): string[] =>
  unique(
    dashboard.rows.flatMap((r) => rowGithubCredentialId(dashboard, r) ?? []),
  );

/** One poll target per token with a reader; `onBudget` gets each read. */
export function budgetTargets({
  credentialIds,
  reader,
  onBudget,
  now,
}: {
  credentialIds: readonly string[];
  reader: (credentialId: string) => GitHubReader | undefined;
  onBudget: (credentialId: string, budget: RateLimitBudget) => void;
  now: () => number;
}): PollTarget[] {
  return credentialIds.flatMap((id) => {
    const r = reader(id);
    if (!r) return [];
    let readAt: number | undefined;
    return [
      {
        id: `budget:${id}`,
        refresh: async () => {
          if (readAt !== undefined && now() - readAt < BUDGET_READ_MS) return;
          readAt = now();
          onBudget(id, await r.readRateLimit());
        },
        // Never "active": the scheduler's idle pace is plenty, since
        // refresh itself reads at most every BUDGET_READ_MS.
        isActive: () => false,
      },
    ];
  });
}
