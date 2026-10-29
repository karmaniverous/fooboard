/**
 * Dismissed unmapped runs (spec 0.2.0 §3.I, Decision 86, Q50 and Q51): a
 * dashboard's patterns that hide entries from the *Unmapped runs* panel.
 * A dismissal sets at least one of `where` (a repo or Amplify app id),
 * `workflow` (a GitHub run's workflow name), `branch` (a branch pattern in
 * the board's syntax) and `reason` (why every row reading the entry
 * can't place it). It only hides entries: it changes nothing the board
 * reads or places. Integrity refuses a dismissal that sets no field and a
 * repeated id (ids are unique within their dashboard only, so *Duplicate*
 * and an import's *Keep as a copy* keep them); an empty field is refused
 * by its schema (clearing a field removes it). Pure.
 *
 * @module
 */
import { z } from 'zod';

import { UNMAPPED } from '@/domain/derivation/unmapped';

/** The reasons a dismissal can name (`UNMAPPED`). */
export const UnmappedReasonKindSchema = z.enum([
  UNMAPPED.noStageMatches,
  UNMAPPED.noRowMatches,
  UNMAPPED.noItemCounts,
  UNMAPPED.noOrderKey,
]);
export type UnmappedReasonKind = z.infer<typeof UnmappedReasonKindSchema>;

/** A dismissal's pattern fields, each optional and never empty. */
export const DISMISSAL_FIELDS = [
  'where',
  'workflow',
  'branch',
  'reason',
] as const;
export type DismissalField = (typeof DISMISSAL_FIELDS)[number];

export const UnmappedDismissalSchema = z.object({
  /** Minted with `crypto.randomUUID()`; unique within its dashboard. */
  id: z.string().min(1),
  /** The repo (`owner/name`) or Amplify app id, as the entry shows it;
   * compared case-insensitively. */
  where: z.string().min(1).optional(),
  /** A GitHub run's workflow name, compared case-insensitively; never
   * matches an Amplify job. */
  workflow: z.string().min(1).optional(),
  /** A branch pattern (`*` within a segment, `**` across them,
   * case-sensitive); never matches an entry without a branch. */
  branch: z.string().min(1).optional(),
  /** Matches when every row reading the entry gives this reason. */
  reason: UnmappedReasonKindSchema.optional(),
});
export type UnmappedDismissal = z.infer<typeof UnmappedDismissalSchema>;

type Issue = { message: string; path: (string | number)[] };

/** Does `dismissal` set any pattern field? */
export const setsAnyField = (
  dismissal: Omit<UnmappedDismissal, 'id'>,
): boolean => DISMISSAL_FIELDS.some((field) => dismissal[field] !== undefined);

/** A dashboard's dismissals that repeat an earlier id or set no field. */
export function dismissalIssues(
  dismissals: readonly UnmappedDismissal[],
): Issue[] {
  const seen = new Set<string>();
  return dismissals.flatMap((dismissal, index) => {
    const path = ['unmappedDismissals', index];
    const issues: Issue[] = [];
    if (seen.has(dismissal.id))
      issues.push({
        message: `duplicate dismissal id: ${dismissal.id}`,
        path: [...path, 'id'],
      });
    seen.add(dismissal.id);
    if (!setsAnyField(dismissal))
      issues.push({ message: 'a dismissal sets no field', path });
    return issues;
  });
}
