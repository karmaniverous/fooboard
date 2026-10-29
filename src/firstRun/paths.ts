/**
 * Where the first run's steps live (spec.md §3.9): step 1 at `/new`, the
 * saved dashboard's repos and stages at `/new/<id>/<step>`, and the board
 * (step 4) at the dashboard's own page, opened with `FIRST_RUN_STATE`.
 *
 * @module
 */
import { z } from 'zod';

import type { Dashboard } from '@/domain/config/dashboard';

/** Step 1: name the dashboard and add a token. */
export const FIRST_RUN_PATH = '/new';

/** The router's pattern for the steps after the token. */
export const FIRST_RUN_STEP_ROUTE = `${FIRST_RUN_PATH}/:id/:step`;

/** The steps after the token, by their path segment. */
export const FirstRunStepSchema = z.enum(['repos', 'stages']);
export type FirstRunStep = z.infer<typeof FirstRunStepSchema>;

/** What each step after the token is given. */
export interface SavedStepProps {
  /** The saved dashboard, as the step opened. */
  dashboard: Dashboard;
  /** Save a change to it (may throw: the step shows the error). */
  onSave: (dashboard: Dashboard) => void;
}

export const firstRunPath = (id: string, step: FirstRunStep): string =>
  `${FIRST_RUN_PATH}/${id}/${step}`;

/** The router state the board is opened with at the end of the steps. */
export const FIRST_RUN_STATE = { firstRun: true } as const;

/** Was the board opened at the end of the first run? */
export const isFirstRunState = (state: unknown): boolean =>
  z.object({ firstRun: z.literal(true) }).safeParse(state).success;
