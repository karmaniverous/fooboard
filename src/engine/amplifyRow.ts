/**
 * The Amplify rows sharing apps, refreshed together (spec.md A§4.3.7):
 * each app is read once per poll however many rows use it (its branch
 * list, then the jobs of the branches the branch rule chooses), each job
 * translated once into a record, and records placed in each row's cells
 * from the apps that row reads. Records kept by *keep* that land in no
 * cell of any row reading their app are unmapped, with each row's reason;
 * a full read gives the row's empty cells a window hint.
 *
 * @module
 */
import type { JSONValue } from 'json-p3';
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
import { type CellRules, placeCell } from '@/domain/model/cell';
import { asJson } from '@/domain/model/json';
import type { SourceRuleOf } from '@/domain/model/sourceRule';
import type { KeyProblem, RecordDoc } from '@/domain/model/translate';
import { evaluateRule } from '@/domain/rules/check';
import { amplifyTranslate } from '@/domain/statuses/documents';
import { AmplifyAuthError, AmplifyThrottledError } from '@/lib/amplify/errors';
import {
  type AmplifyReaderFor,
  appKey,
  memoizeReaderFor,
  readAppJobs,
  type ResolvedAmplifySource,
} from '@/lib/amplify/rowJobs';

import { amplifyUnmapped } from './amplifyUnmapped';
import { emptyCells } from './cells';
import { failureOutcome } from './providerOutcome';
import type { UnmappedRun } from './types';

export type AmplifyRowsRefresh =
  | {
      kind: 'refreshed';
      /** Each row's cells, by stage id. */
      rows: Record<string, Record<string, CellDerivation>>;
      /** Keys the source rule couldn't translate cleanly. */
      keyProblems: KeyProblem[];
      unmapped: UnmappedRun[];
      /** Rows reading an app whose read came back full. */
      fullRows: string[];
      /** The branch list entries read. */
      branches: JSONValue[];
    }
  | { kind: 'rate-limited' };

export interface AmplifyRowsInput {
  rows: readonly AmplifyRow[];
  stages: readonly Stage[];
  rulesFor: (row: AmplifyRow, stageId: string) => CellRules;
  defaultsFor: (row: AmplifyRow) => DefaultCredentials;
  readersFor: (credentialId: string) => AmplifyReaderFor | undefined;
  source: SourceRuleOf<'amplify'>;
}

/** A row's apps with their credentials, or `undefined` when one has no
 * credential or no reader. */
export function resolvedSources(
  row: AmplifyRow,
  defaults: DefaultCredentials,
  readersFor: AmplifyRowsInput['readersFor'],
): ResolvedAmplifySource[] | undefined {
  const out: ResolvedAmplifySource[] = [];
  for (const s of row.sources) {
    const credentialId = resolveCredentialId(defaults, 'aws', s.credentialId);
    if (!credentialId || !readersFor(credentialId)) return undefined;
    out.push({ ...s, credentialId });
  }
  return out;
}

const emptyRowCells = (
  input: AmplifyRowsInput,
  row: AmplifyRow,
  credentialStatus: CredentialStatus,
  providerFailure?: ProviderFailure,
) =>
  emptyCells(
    input.stages,
    (stageId) => input.rulesFor(row, stageId).set,
    credentialStatus,
    providerFailure,
  );

interface AppRecords {
  records: RecordDoc[];
  full: boolean;
}

export async function refreshAmplifyRows(
  input: AmplifyRowsInput,
): Promise<AmplifyRowsRefresh> {
  const { source } = input;
  const rows: Record<string, Record<string, CellDerivation>> = {};
  const reading = new Map<string, ResolvedAmplifySource[]>();
  for (const row of input.rows) {
    const sources = resolvedSources(
      row,
      input.defaultsFor(row),
      input.readersFor,
    );
    if (sources) reading.set(row.id, sources);
    else rows[row.id] = emptyRowCells(input, row, 'missing');
  }
  const readerFor: AmplifyReaderFor = memoizeReaderFor((s) => {
    const forCredential = input.readersFor(s.credentialId);
    if (!forCredential) throw new Error('missing Amplify credential');
    return forCredential(s);
  });
  const keyProblems: KeyProblem[] = [];
  const branches: JSONValue[] = [];
  const apps = new Map<string, AppRecords>();
  try {
    for (const s of [...reading.values()].flat()) {
      const key = appKey(s);
      if (apps.has(key)) continue;
      const read = await readAppJobs(s, readerFor, source.reader);
      branches.push(...read.branches.map((b) => asJson(b)));
      const translated = read.jobs.map((j) => amplifyTranslate(j, source));
      keyProblems.push(...translated.flatMap((t) => t.problems));
      apps.set(key, {
        records: translated
          .map((t) => t.record)
          .filter((r) => evaluateRule(source.keep, r)),
        full: read.full,
      });
    }
  } catch (err) {
    const outcome = failureOutcome(err, {
      isRateLimit: (e) => e instanceof AmplifyThrottledError,
      isAuth: (e) => e instanceof AmplifyAuthError,
    });
    if (outcome.kind === 'rate-limited') return outcome;
    for (const row of input.rows)
      if (reading.has(row.id))
        rows[row.id] = emptyRowCells(
          input,
          row,
          outcome.credentialStatus,
          outcome.providerFailure,
        );
    return {
      kind: 'refreshed',
      rows,
      keyProblems: [],
      unmapped: [],
      fullRows: [],
      branches: [],
    };
  }
  const appsOf = (rowId: string) =>
    (reading.get(rowId) ?? []).flatMap((s) => apps.get(appKey(s)) ?? []);
  for (const row of input.rows) {
    if (!reading.has(row.id)) continue;
    const records = appsOf(row.id).flatMap((a) => a.records);
    rows[row.id] = objectify(
      input.stages,
      (s) => s.id,
      (s) => {
        const rules = input.rulesFor(row, s.id);
        return deriveCell({
          placed:
            rules.stage === undefined ? undefined : placeCell(records, rules),
          set: rules.set,
          credentialStatus: 'ok',
        });
      },
    );
  }
  return {
    kind: 'refreshed',
    rows,
    keyProblems,
    unmapped: amplifyUnmapped(input, reading, apps),
    fullRows: input.rows
      .filter((r) => appsOf(r.id).some((a) => a.full))
      .map((r) => r.id),
    branches,
  };
}
