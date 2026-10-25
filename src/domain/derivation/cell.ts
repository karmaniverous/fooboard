/**
 * A cell's derivation (spec.md A§4.3.7): the record placement put there,
 * its status, and what the board shows of it (the reserved keys `branch`,
 * `commit`, `message`, `time`, `link`, when present), or why the cell is
 * empty: needs a credential, an error, no records, or (an Amplify cell)
 * no app to read (spec.md §3.12). Pure.
 *
 * @module
 */

import type { StatusSet } from '@/domain/config/statusSets';
import type { PlacedRecord } from '@/domain/model/cell';
import { textOf } from '@/domain/model/json';
import type { RecordDoc } from '@/domain/model/translate';
import { type ResolvedStatus, resolveStatus } from '@/domain/statuses/resolved';

export type CredentialStatus = 'ok' | 'missing' | 'expired';

/** A provider read that failed (not for want of a credential). */
export interface ProviderFailure {
  message: string;
  isRateLimit: boolean;
}

/** Why a cell is empty. */
export const EMPTY_STATES = {
  noRecords: 'no-records',
  needsCredential: 'needs-credential',
  error: 'error',
  /** An Amplify cell with no app to read: none builds the row's repo in
   * its key's account, and none is pinned (spec.md §3.12). */
  noApp: 'no-app',
} as const;
export type EmptyCellState = (typeof EMPTY_STATES)[keyof typeof EMPTY_STATES];

export interface EmptyCellResult {
  kind: 'empty';
  state: EmptyCellState;
  reason?: string;
}

export interface CellResult {
  kind: 'ok';
  status: ResolvedStatus;
  branch?: string;
  commit?: string;
  message?: string;
  time?: string;
  linkUrl?: string;
  /** The record its status rules saw (counted items only). */
  document: RecordDoc;
}

export type CellDerivation = CellResult | EmptyCellResult;

/** The derivation for a cell given what placement put there. */
export function deriveCell(input: {
  placed: PlacedRecord | undefined;
  set: StatusSet;
  credentialStatus: CredentialStatus;
  providerFailure?: ProviderFailure;
}): CellDerivation {
  if (input.credentialStatus !== 'ok')
    return { kind: 'empty', state: EMPTY_STATES.needsCredential };
  if (input.providerFailure && !input.providerFailure.isRateLimit)
    return {
      kind: 'empty',
      state: 'error',
      reason: input.providerFailure.message,
    };
  const { placed } = input;
  if (!placed) return { kind: 'empty', state: EMPTY_STATES.noRecords };
  const { record } = placed;
  return {
    kind: 'ok',
    status: resolveStatus(input.set, placed.status),
    branch: textOf(record.branch),
    commit: textOf(record.commit),
    message: textOf(record.message),
    time: textOf(placed.time),
    linkUrl: textOf(placed.link),
    document: record,
  };
}
