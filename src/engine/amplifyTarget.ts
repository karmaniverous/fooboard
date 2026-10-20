/**
 * Amplify poll targets (spec.md A§4.3.7): rows that share an app are one
 * target, so each app is read once per poll however many rows use it, as
 * GitHub repos are per repo and token. A target's refresh places every
 * row's cells, adds staleness from each row's git link, and reports its
 * unmapped jobs, translation problems and window hints.
 *
 * @module
 */
import type { JSONValue } from 'json-p3';

import type { DefaultCredentials } from '@/domain/config/credentialRefs';
import type { AmplifyRow } from '@/domain/config/row';
import type { Stage } from '@/domain/config/stage';
import type { CellRules } from '@/domain/model/cell';
import type { SourceRuleOf } from '@/domain/model/sourceRule';
import type { Problem } from '@/domain/problems/problem';
import { translationProblems } from '@/domain/problems/runtime';
import { type AmplifyReaderFor, appKey } from '@/lib/amplify/rowJobs';
import type { GitHubReader } from '@/lib/github';

import { refreshAmplifyRows, resolvedSources } from './amplifyRow';
import { cellViews } from './cells';
import type { RowUpdate } from './model';
import { compareOnce, readStaleness } from './staleness';
import type { UnmappedRun } from './types';
import { windowHints } from './windowHints';

/** Rows grouped so that rows sharing an app are in one group. A row
 * whose apps can't be resolved (no credential) is a group of its own. */
export function amplifyGroups(
  rows: readonly AmplifyRow[],
  appsOf: (row: AmplifyRow) => readonly string[],
): AmplifyRow[][] {
  const groups: { apps: Set<string>; rows: AmplifyRow[] }[] = [];
  for (const row of rows) {
    const apps = appsOf(row);
    const joined = groups.filter((g) => apps.some((a) => g.apps.has(a)));
    const merged = {
      apps: new Set([...apps, ...joined.flatMap((g) => [...g.apps])]),
      rows: [...joined.flatMap((g) => g.rows), row],
    };
    for (const g of joined) groups.splice(groups.indexOf(g), 1);
    groups.push(merged);
  }
  // Keep the board's row order within and across groups.
  const order = new Map(rows.map((r, i) => [r.id, i]));
  const rank = (row: AmplifyRow) => order.get(row.id) ?? 0;
  return groups
    .map((g) => g.rows.sort((a, b) => rank(a) - rank(b)))
    .sort((a, b) => rank(a[0]) - rank(b[0]));
}

/** The keys of the apps `row` reads (none when it can't read them). */
export const rowAppKeys = (
  row: AmplifyRow,
  defaults: DefaultCredentials,
  readersFor: (credentialId: string) => AmplifyReaderFor | undefined,
): string[] => (resolvedSources(row, defaults, readersFor) ?? []).map(appKey);

export interface AmplifyTargetInput {
  rows: readonly AmplifyRow[];
  stages: readonly Stage[];
  rulesFor: (row: AmplifyRow, stageId: string) => CellRules;
  defaultsFor: (row: AmplifyRow) => DefaultCredentials;
  readersFor: (credentialId: string) => AmplifyReaderFor | undefined;
  source: SourceRuleOf<'amplify'>;
  /** The GitHub reader for a row's git link, if it has one. */
  githubFor: (row: AmplifyRow) => GitHubReader | undefined;
}

export type AmplifyTargetRefresh =
  | { kind: 'rate-limited' }
  | {
      kind: 'refreshed';
      rows: Record<string, RowUpdate>;
      unmapped: UnmappedRun[];
      problems: Problem[];
      branches: JSONValue[];
    };

export async function refreshAmplifyTarget(
  input: AmplifyTargetInput,
): Promise<AmplifyTargetRefresh> {
  const result = await refreshAmplifyRows(input);
  if (result.kind === 'rate-limited') return result;
  const rows: Record<string, RowUpdate> = {};
  const views: Record<string, ReturnType<typeof cellViews>> = {};
  for (const row of input.rows) {
    const cells = cellViews(result.rows[row.id] ?? {});
    views[row.id] = cells;
    const reader = input.githubFor(row);
    rows[row.id] = {
      cells,
      staleness: reader
        ? await readStaleness(
            input.stages,
            reader,
            cells,
            compareOnce(reader, row.repo),
          )
        : {},
    };
  }
  const { source } = input;
  const full = Object.fromEntries(
    result.fullRows.map((id) => [id, views[id] ?? {}]),
  );
  return {
    kind: 'refreshed',
    rows,
    unmapped: result.unmapped,
    problems: [
      ...translationProblems(source, result.keyProblems),
      ...windowHints(full, source),
    ],
    branches: result.branches,
  };
}
