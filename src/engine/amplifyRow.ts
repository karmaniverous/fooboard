/**
 * Refresh one Amplify row (spec.md §4.3.4): per stage, the jobs across the
 * row's sources on branches matching the stage pattern, derived into a
 * cell. A source whose credential is missing or rejected makes the row
 * *needs credential*; throttling keeps the previous cells; other failures
 * show *error*.
 *
 * @module
 */
import type { AmplifyRow } from '@/domain/config/row';
import type { Stage } from '@/domain/config/stage';
import {
  type AmplifyCellDerivation,
  type CredentialStatus,
  deriveAmplifyCell,
  type ProviderFailure,
} from '@/domain/derivation';
import { AmplifyAuthError, AmplifyThrottledError } from '@/lib/amplify/errors';
import { type AmplifyReaderFor, collectRowJobs } from '@/lib/amplify/rowJobs';
import { describeError } from '@/lib/errors';

/** A refreshed Amplify row, or throttled (keep the previous cells). */
export type AmplifyRowRefresh =
  | { kind: 'refreshed'; cells: Record<string, AmplifyCellDerivation> }
  | { kind: 'rate-limited' };

function emptyRow(
  stages: readonly Stage[],
  credentialStatus: CredentialStatus,
  providerFailure?: ProviderFailure,
): AmplifyRowRefresh {
  const cells = Object.fromEntries(
    stages.map((s) => [
      s.id,
      deriveAmplifyCell({
        jobsByBranch: [],
        branchExists: false,
        credentialStatus,
        providerFailure,
      }),
    ]),
  );
  return { kind: 'refreshed', cells };
}

/** Refresh one Amplify row. `readersFor(credentialId)` is `undefined` when
 * that credential is missing. */
export async function refreshAmplifyRow(
  row: AmplifyRow,
  stages: readonly Stage[],
  readersFor: (credentialId: string) => AmplifyReaderFor | undefined,
): Promise<AmplifyRowRefresh> {
  const readers = new Map(
    row.sources.map((s) => [s.credentialId, readersFor(s.credentialId)]),
  );
  if ([...readers.values()].some((r) => r === undefined)) {
    return emptyRow(stages, 'missing');
  }
  const readerFor: AmplifyReaderFor = (source) => {
    const forCredential = readers.get(source.credentialId);
    if (!forCredential) throw new Error('missing Amplify credential');
    return forCredential(source);
  };

  try {
    const cells: Record<string, AmplifyCellDerivation> = {};
    for (const stage of stages) {
      const jobs = await collectRowJobs(
        row.sources,
        stage.branchPattern,
        readerFor,
      );
      cells[stage.id] = deriveAmplifyCell({ ...jobs, credentialStatus: 'ok' });
    }
    return { kind: 'refreshed', cells };
  } catch (err) {
    if (err instanceof AmplifyThrottledError) return { kind: 'rate-limited' };
    if (err instanceof AmplifyAuthError) return emptyRow(stages, 'expired');
    return emptyRow(stages, 'ok', {
      message: describeError(err),
      isRateLimit: false,
    });
  }
}
