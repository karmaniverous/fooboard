/**
 * Cell views as the GitHub and Amplify rows both build them (spec.md
 * §3.1): a final derivation, active while its status is in progress, and
 * the empty cells a row shows when it can't be read. Pure.
 *
 * @module
 */
import { objectify } from 'radash';

import type { StatusSet } from '@/domain/config/statusSets';
import {
  type CellDerivation,
  type CredentialStatus,
  deriveCell,
  EMPTY_STATES,
  type ProviderFailure,
} from '@/domain/derivation';
import { inProgress } from '@/domain/statuses/resolved';

import type { CellView } from './types';

/** `derivation` as a final view, active while its status is in progress. */
export const finalView = (derivation: CellDerivation): CellView => ({
  derivation,
  active: inProgress(derivation),
  pending: false,
});

/** *No app* cells (spec.md §3.12), by stage id, saying `reason`. */
export const noAppViews = (
  stages: readonly { id: string }[],
  reason: string,
): Record<string, CellView> =>
  objectify(
    stages,
    (s) => s.id,
    () => finalView({ kind: 'empty', state: EMPTY_STATES.noApp, reason }),
  );

/** A row's cells, by stage id, when it can't be read: no credential, a
 * rejected one, or a failed read. */
export const emptyViews = (
  stages: readonly { id: string }[],
  setFor: (stageId: string) => StatusSet,
  credentialStatus: CredentialStatus,
  providerFailure?: ProviderFailure,
): Record<string, CellView> =>
  objectify(
    stages,
    (s) => s.id,
    (s) =>
      finalView(
        deriveCell({
          placed: undefined,
          set: setFor(s.id),
          credentialStatus,
          providerFailure,
        }),
      ),
  );
