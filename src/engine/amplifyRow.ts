/**
 * Refresh one Amplify row (spec.md §4.3.4): per stage, the jobs across the
 * row's sources on branches matching the stage pattern, derived into a
 * cell. A source whose credential is missing or rejected makes the row
 * *needs credential*; throttling keeps the previous cells; other failures
 * show *error*.
 *
 * @module
 */
import { objectify } from 'radash';

import {
  type DefaultCredentials,
  resolveCredentialId,
} from '@/domain/config/credentialRefs';
import type { AmplifyRow } from '@/domain/config/row';
import type { Stage } from '@/domain/config/stage';
import type { StatusSet } from '@/domain/config/statusSets';
import {
  type AmplifyCellDerivation,
  type CredentialStatus,
  deriveAmplifyCell,
  type ProviderFailure,
} from '@/domain/derivation';
import { AmplifyAuthError, AmplifyThrottledError } from '@/lib/amplify/errors';
import {
  type AmplifyReaderFor,
  collectRowJobs,
  memoizeReaderFor,
  type ResolvedAmplifySource,
} from '@/lib/amplify/rowJobs';

import { failureOutcome } from './providerOutcome';

/** A refreshed Amplify row, or throttled (keep the previous cells). */
export type AmplifyRowRefresh =
  | { kind: 'refreshed'; cells: Record<string, AmplifyCellDerivation> }
  | { kind: 'rate-limited' };

/** The status set a cell in a stage uses (A§4.3.6). */
type SetFor = (stageId: string) => StatusSet;

function emptyRow(
  stages: readonly Stage[],
  setFor: SetFor,
  credentialStatus: CredentialStatus,
  providerFailure?: ProviderFailure,
): AmplifyRowRefresh {
  const cells = objectify(
    stages,
    (s) => s.id,
    (s) =>
      deriveAmplifyCell({
        jobsByBranch: [],
        set: setFor(s.id),
        branchExists: false,
        credentialStatus,
        providerFailure,
      }),
  );
  return { kind: 'refreshed', cells };
}

/** Refresh one Amplify row. Each source uses its own AWS key if set, else
 * the dashboard default; `readersFor(credentialId)` is `undefined` when
 * that key hasn't been entered. Any source without a usable key makes the
 * row *needs credential*. */
export async function refreshAmplifyRow(
  row: AmplifyRow,
  stages: readonly Stage[],
  setFor: SetFor,
  defaults: DefaultCredentials,
  readersFor: (credentialId: string) => AmplifyReaderFor | undefined,
): Promise<AmplifyRowRefresh> {
  const sources: ResolvedAmplifySource[] = [];
  for (const source of row.sources) {
    const credentialId = resolveCredentialId(
      defaults,
      'aws',
      source.credentialId,
    );
    if (!credentialId) return emptyRow(stages, setFor, 'missing');
    sources.push({ ...source, credentialId });
  }
  const readers = new Map(
    sources.map((s) => [s.credentialId, readersFor(s.credentialId)]),
  );
  if ([...readers.values()].some((r) => r === undefined)) {
    return emptyRow(stages, setFor, 'missing');
  }
  // One read per source and branch, however many stages share it.
  const readerFor: AmplifyReaderFor = memoizeReaderFor((source) => {
    const forCredential = readers.get(source.credentialId);
    if (!forCredential) throw new Error('missing Amplify credential');
    return forCredential(source);
  });

  try {
    const cells: Record<string, AmplifyCellDerivation> = {};
    for (const stage of stages) {
      const jobs = await collectRowJobs(
        sources,
        stage.branchPattern,
        readerFor,
      );
      cells[stage.id] = deriveAmplifyCell({
        ...jobs,
        set: setFor(stage.id),
        credentialStatus: 'ok',
      });
    }
    return { kind: 'refreshed', cells };
  } catch (err) {
    const outcome = failureOutcome(err, {
      isRateLimit: (e) => e instanceof AmplifyThrottledError,
      isAuth: (e) => e instanceof AmplifyAuthError,
    });
    return outcome.kind === 'rate-limited'
      ? outcome
      : emptyRow(
          stages,
          setFor,
          outcome.credentialStatus,
          outcome.providerFailure,
        );
  }
}

/** Cell views for an Amplify row: a cell is active while its status
 * counts toward an in-progress summary (it drives the faster poll). */
export function amplifyCellViews(
  cells: Readonly<Record<string, AmplifyCellDerivation>>,
): Record<string, { derivation: AmplifyCellDerivation; active: boolean }> {
  return Object.fromEntries(
    Object.entries(cells).map(([stageId, derivation]) => [
      stageId,
      {
        derivation,
        active:
          derivation.kind === 'ok' && derivation.status.summary.inProgress,
      },
    ]),
  );
}
