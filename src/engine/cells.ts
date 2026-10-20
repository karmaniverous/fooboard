/**
 * Cells as the GitHub and Amplify refreshers both build them (spec.md
 * A§4.3.7, §4.3.5): a derivation marked active while its status is in
 * progress, and the empty cells a row shows when it can't be read. Pure.
 *
 * @module
 */
import { objectify } from 'radash';

import type { StatusSet } from '@/domain/config/statusSets';
import {
  type CellDerivation,
  type CredentialStatus,
  deriveCell,
  type ProviderFailure,
} from '@/domain/derivation';
import { inProgress } from '@/domain/statuses/resolved';

import type { CellView } from './types';

/** `derivation`, active while its status is in progress. */
export const cellView = (derivation: CellDerivation): CellView => ({
  derivation,
  active: inProgress(derivation),
});

/** Each cell's derivation as a view, by stage id. */
export const cellViews = (
  cells: Readonly<Record<string, CellDerivation>>,
): Record<string, CellView> =>
  Object.fromEntries(
    Object.entries(cells).map(([stageId, d]) => [stageId, cellView(d)]),
  );

/** A row's cells, by stage id, when it can't be read: no credential, a
 * rejected one, or a failed read. */
export const emptyCells = (
  stages: readonly { id: string }[],
  setFor: (stageId: string) => StatusSet,
  credentialStatus: CredentialStatus,
  providerFailure?: ProviderFailure,
): Record<string, CellDerivation> =>
  objectify(
    stages,
    (s) => s.id,
    (s) =>
      deriveCell({
        placed: undefined,
        set: setFor(s.id),
        credentialStatus,
        providerFailure,
      }),
  );
