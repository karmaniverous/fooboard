/**
 * A cell's status as the board shows it (spec.md A§4.3.6): the matched
 * cell status with its summary status folded in, or the built-in Unknown
 * when a relevant run matches none, so a gap in the rules is visible.
 *
 * @module
 */
import {
  type CellStatus,
  type StatusIcon,
  type StatusSet,
  type SummaryStatus,
  UNKNOWN_STATUS_ID,
} from '@/domain/config/statusSets';

import { classify } from './classify';

export interface ResolvedStatus {
  id: string;
  name: string;
  color: string;
  icon: StatusIcon;
  outlined: boolean;
  summary: SummaryStatus;
  /** The summary status's place in its set, for ordering chips. */
  rank: number;
}

/** The built-in Unknown summary status (its own chip, shown when any). */
const UNKNOWN_SUMMARY: SummaryStatus = {
  id: UNKNOWN_STATUS_ID,
  name: 'Unknown',
  color: '#a21caf',
  icon: 'unknown',
  inProgress: false,
};

/** What a relevant run that matches no cell status shows. */
export const UNKNOWN: ResolvedStatus = {
  id: UNKNOWN_STATUS_ID,
  name: 'Unknown',
  color: UNKNOWN_SUMMARY.color,
  icon: 'unknown',
  outlined: false,
  summary: UNKNOWN_SUMMARY,
  rank: Number.MAX_SAFE_INTEGER,
};

/** `status` (from `set`) as the board shows it; none is Unknown. */
export function resolveStatus(
  set: Pick<StatusSet, 'summary'>,
  status: CellStatus | undefined,
): ResolvedStatus {
  if (!status) return UNKNOWN;
  const rank = set.summary.findIndex((s) => s.id === status.summary);
  const summary = set.summary[rank] ?? UNKNOWN_SUMMARY;
  return {
    id: status.id,
    name: status.name,
    color: status.color,
    icon: status.icon ?? summary.icon,
    outlined: status.outlined,
    summary,
    rank: rank < 0 ? Number.MAX_SAFE_INTEGER : rank,
  };
}

/** Is a derived cell still in progress? It counts toward an in-progress
 * summary status, and is polled at the active interval (C-16). */
export const inProgress = (
  derivation: { kind: 'ok'; status: ResolvedStatus } | { kind: 'empty' },
): boolean => derivation.kind === 'ok' && derivation.status.summary.inProgress;

/** Classify `doc` against `set` and resolve the result. */
export const statusOf = (doc: unknown, set: StatusSet): ResolvedStatus =>
  resolveStatus(set, classify(doc, set));
