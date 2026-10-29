/**
 * Which unmapped entries a dashboard's dismissals hide (spec 0.2.0 §3.I,
 * Decision 86): an entry is dismissed when any dismissal matches every
 * field it sets. `where` and `workflow` compare case-insensitively, a
 * workflow never matching an Amplify job; `branch` is a branch pattern,
 * never matching an entry without a branch; `reason` matches when every
 * row reading the entry gives it. Matching only hides entries from the
 * panel and its button: the board reads and places runs as before. The
 * presets the *Dismiss…* form offers for an entry are here too. Pure.
 *
 * @module
 */
import type {
  UnmappedDismissal,
  UnmappedReasonKind,
} from '@/domain/config/unmappedDismissals';
import { matchesBranchPattern } from '@/domain/matching/branchPattern';

import type { UnmappedRun } from './types';

/** A dismissal's pattern: every field but its id. */
export type DismissalPattern = Omit<UnmappedDismissal, 'id'>;

const same = (a: string, b: string): boolean =>
  a.toLowerCase() === b.toLowerCase();

/** The one reason every row reading `run` gives, if they agree. */
export function sharedReason(run: UnmappedRun): UnmappedReasonKind | undefined {
  const kinds = new Set(run.rows.map((r) => r.reason.kind));
  return kinds.size === 1 ? [...kinds][0] : undefined;
}

/** Does `pattern` match `run` on every field it sets? */
export function matchesDismissal(
  pattern: DismissalPattern,
  run: UnmappedRun,
): boolean {
  const { where, workflow, branch, reason } = pattern;
  if (where !== undefined && !same(where, run.where)) return false;
  if (
    workflow !== undefined &&
    (run.provider !== 'github' || !same(workflow, run.title))
  )
    return false;
  if (
    branch !== undefined &&
    (run.branch === null || !matchesBranchPattern(branch, run.branch))
  )
    return false;
  return reason === undefined || sharedReason(run) === reason;
}

/** An entry a dismissal hides, with the first dismissal that does. */
export interface DismissedRun {
  run: UnmappedRun;
  by: UnmappedDismissal;
}

/** `unmapped` split into the entries shown and those dismissed. */
export function splitUnmapped(
  unmapped: readonly UnmappedRun[],
  dismissals: readonly UnmappedDismissal[],
): { shown: UnmappedRun[]; dismissed: DismissedRun[] } {
  const shown: UnmappedRun[] = [];
  const dismissed: DismissedRun[] = [];
  for (const run of unmapped) {
    const by = dismissals.find((d) => matchesDismissal(d, run));
    if (by) dismissed.push({ run, by });
    else shown.push(run);
  }
  return { shown, dismissed };
}

/** The presets the *Dismiss…* form offers. */
export const DISMISS_PRESETS = {
  workflow: 'This workflow on any branch',
  branchHere: 'This branch here',
  branchesLike: 'Branches like this anywhere',
  reason: 'Everything with this reason',
} as const;
export type DismissPresetId = keyof typeof DISMISS_PRESETS;

/** A preset: its id and the pattern it fills the form with. */
export interface DismissPreset {
  id: DismissPresetId;
  label: string;
  pattern: DismissalPattern;
}

/** The segment separator of a branch name. */
const SEGMENT = '/';
/** What replaces a branch's last segment for *Branches like this*. */
const ANY_SEGMENT = '*';

/** `branch` with its last segment replaced by `*`, for a branch of two or
 * more segments (`feature/login` → `feature/*`); none for one segment,
 * where `*` would match every one-segment branch. */
export function branchesLike(branch: string): string | undefined {
  const segments = branch.split(SEGMENT);
  if (segments.length < 2) return undefined;
  return [...segments.slice(0, -1), ANY_SEGMENT].join(SEGMENT);
}

/** The presets for `run`, in the form's order. There is no *This exact
 * run*: a pattern naming one run would stop matching at the next
 * (Decision 101). */
export function presetsFor(run: UnmappedRun): DismissPreset[] {
  const presets: DismissPreset[] = [];
  const add = (id: DismissPresetId, pattern: DismissalPattern) =>
    presets.push({ id, label: DISMISS_PRESETS[id], pattern });
  if (run.provider === 'github')
    add('workflow', { where: run.where, workflow: run.title });
  if (run.branch !== null) {
    add('branchHere', { where: run.where, branch: run.branch });
    const like = branchesLike(run.branch);
    if (like !== undefined) add('branchesLike', { branch: like });
  }
  const reason = sharedReason(run);
  if (reason !== undefined) add('reason', { reason });
  return presets;
}
