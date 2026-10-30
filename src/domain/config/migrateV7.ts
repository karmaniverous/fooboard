/**
 * The v6 → v7 migration step (spec 0.2.0 §3.I, Decision 86): each
 * dashboard gains `unmappedDismissals`, the patterns hiding entries from
 * the *Unmapped runs* panel. A dashboard without the field gets an empty
 * list, frozen here; one that has a list keeps it, so the step is
 * idempotent. A malformed dashboard list is left as it is, for
 * validation to refuse (as `addSettings` does), so the store keeps it
 * read-only rather than saving an empty configuration over it.
 *
 * @module
 */
import { z } from 'zod';

/** A dashboard list as stored: absent means none. */
const DashboardListSchema = z
  .array(z.record(z.string(), z.unknown()))
  .optional();

/** The dismissals v7 gives a v6 dashboard: none. */
const v7Dismissals = (): unknown[] => [];

/** v6 → v7: every dashboard without `unmappedDismissals` gains an empty
 * list. */
export const toV7 = (
  input: Record<string, unknown>,
): Record<string, unknown> => {
  const list = DashboardListSchema.safeParse(input.dashboards);
  if (!list.success) return input;
  return {
    ...input,
    dashboards: (list.data ?? []).map((d) => ({
      unmappedDismissals: v7Dismissals(),
      ...d,
    })),
  };
};
