/**
 * A cell's derivation (spec.md A§4.3.7): the record placement put there,
 * its status, and what the board shows of it (the reserved keys `branch`,
 * `commit`, `message`, `time`, `link`, when present), or why the cell is
 * empty: needs a credential, an error, or no records. Pure.
 *
 * @module
 */
import type { JSONValue } from 'json-p3';

import type { StatusSet } from '@/domain/config/statusSets';
import type { PlacedRecord } from '@/domain/model/cell';
import type { RecordDoc } from '@/domain/model/translate';
import { type ResolvedStatus, resolveStatus } from '@/domain/statuses/resolved';

export type CredentialStatus = 'ok' | 'missing' | 'expired';

/** A provider read that failed (not for want of a credential). */
export interface ProviderFailure {
  message: string;
  isRateLimit: boolean;
}

export type EmptyCellState = 'no-records' | 'needs-credential' | 'error';

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

/** A reserved key's value as text, if it has one. */
const text = (value: JSONValue | undefined): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

/** The derivation for a cell given what placement put there. */
export function deriveCell(input: {
  placed: PlacedRecord | undefined;
  set: StatusSet;
  credentialStatus: CredentialStatus;
  providerFailure?: ProviderFailure;
}): CellDerivation {
  if (input.credentialStatus !== 'ok')
    return { kind: 'empty', state: 'needs-credential' };
  if (input.providerFailure && !input.providerFailure.isRateLimit)
    return {
      kind: 'empty',
      state: 'error',
      reason: input.providerFailure.message,
    };
  const { placed } = input;
  if (!placed) return { kind: 'empty', state: 'no-records' };
  const { record } = placed;
  return {
    kind: 'ok',
    status: resolveStatus(input.set, placed.status),
    branch: text(record.branch),
    commit: text(record.commit),
    message: text(record.message),
    time: text(placed.time),
    linkUrl: text(placed.link),
    document: record,
  };
}
