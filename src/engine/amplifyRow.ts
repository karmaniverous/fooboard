/**
 * One Amplify row's refresh (spec.md A§4.3.7): read the jobs of every
 * branch of the row's apps once, translate each into a record, and place
 * records in each of the row's cells.
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
import {
  type CellDerivation,
  type CredentialStatus,
  deriveCell,
  type ProviderFailure,
} from '@/domain/derivation';
import { BUILTIN_SOURCES } from '@/domain/model/builtinSources';
import { type CellRules, placeCell } from '@/domain/model/cell';
import type { SourceRule } from '@/domain/model/sourceRule';
import { amplifyRecord } from '@/domain/statuses/documents';
import { inProgress } from '@/domain/statuses/resolved';
import { AmplifyAuthError, AmplifyThrottledError } from '@/lib/amplify/errors';
import {
  type AmplifyReaderFor,
  collectRowJobs,
  memoizeReaderFor,
  type ResolvedAmplifySource,
} from '@/lib/amplify/rowJobs';

import { failureOutcome } from './providerOutcome';

export type AmplifyRowRefresh =
  | { kind: 'refreshed'; cells: Record<string, CellDerivation> }
  | { kind: 'rate-limited' };

type RulesFor = (stageId: string) => CellRules;

function emptyRow(
  stages: readonly Stage[],
  rulesFor: RulesFor,
  credentialStatus: CredentialStatus,
  providerFailure?: ProviderFailure,
): AmplifyRowRefresh {
  const cells = objectify(
    stages,
    (s) => s.id,
    (s) =>
      deriveCell({
        placed: undefined,
        set: rulesFor(s.id).set,
        credentialStatus,
        providerFailure,
      }),
  );
  return { kind: 'refreshed', cells };
}

const sourceFor = (provider: SourceRule['provider']): SourceRule => {
  const rule = BUILTIN_SOURCES.find((s) => s.provider === provider);
  if (!rule) throw new Error(`no built-in source rule for ${provider}`);
  return rule;
};

export async function refreshAmplifyRow(
  row: AmplifyRow,
  stages: readonly Stage[],
  rulesFor: RulesFor,
  defaults: DefaultCredentials,
  readersFor: (credentialId: string) => AmplifyReaderFor | undefined,
  source: SourceRule = sourceFor('amplify'),
): Promise<AmplifyRowRefresh> {
  const sources: ResolvedAmplifySource[] = [];
  for (const source of row.sources) {
    const credentialId = resolveCredentialId(
      defaults,
      'aws',
      source.credentialId,
    );
    if (!credentialId) return emptyRow(stages, rulesFor, 'missing');
    sources.push({ ...source, credentialId });
  }
  const readers = new Map(
    sources.map((s) => [s.credentialId, readersFor(s.credentialId)]),
  );
  if ([...readers.values()].some((r) => r === undefined)) {
    return emptyRow(stages, rulesFor, 'missing');
  }
  const readerFor: AmplifyReaderFor = memoizeReaderFor((source) => {
    const forCredential = readers.get(source.credentialId);
    if (!forCredential) throw new Error('missing Amplify credential');
    return forCredential(source);
  });
  try {
    const options =
      source.provider === 'amplify'
        ? source.reader
        : {
            jobsPerBranch: 20,
            branches: { combine: 'and' as const, checks: [] },
          };
    const records = (await collectRowJobs(sources, readerFor, options)).map(
      (j) => amplifyRecord(j, source),
    );
    const cells: Record<string, CellDerivation> = {};
    for (const stage of stages) {
      const rules = rulesFor(stage.id);
      cells[stage.id] = deriveCell({
        placed:
          rules.stage === undefined ? undefined : placeCell(records, rules),
        set: rules.set,
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
          rulesFor,
          outcome.credentialStatus,
          outcome.providerFailure,
        );
  }
}

/** Each cell's derivation, active while its status is in progress. */
export function amplifyCellViews(
  cells: Readonly<Record<string, CellDerivation>>,
): Record<string, { derivation: CellDerivation; active: boolean }> {
  return Object.fromEntries(
    Object.entries(cells).map(([stageId, derivation]) => [
      stageId,
      { derivation, active: inProgress(derivation) },
    ]),
  );
}
