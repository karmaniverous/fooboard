/**
 * One Amplify row derived from the cache (spec.md §3.1, §2.3, §3.12):
 * each cell reads the apps its AWS key gives it (`amplifyAccess`: pinned
 * apps, else the apps the key's search finds building the row's repo), so
 * the row's columns derive in parts, one per key, and merge. A cell shows
 * as soon as a landed record places it; until every app its part reads
 * has landed it is not settled, and a cell no landed record places stays
 * loading, as do the cells of a part whose search hasn't finished. A cell
 * whose key can't be resolved (none set at any level, or no secret
 * entered) shows *Needs credential*, with one dismissable problem per
 * missing kind naming the row's columns (Decisions 21, 48). A part whose
 * search failed shows *Error* naming the region; one with no app shows
 * *No app* with its problem; one reading several found apps pools them,
 * with the *Pin* problem. A failed read of one app shows on the cells
 * reading that app only. A part is refreshing while any of its apps'
 * reads has been fetching longer than the refreshing delay or is older
 * than its poll interval (Decisions 46, 47). Pure.
 *
 * @module
 */
import type { QueryClient } from '@tanstack/query-core';

import type { AmplifyRow } from '@/domain/config/row';
import type { Stage } from '@/domain/config/stage';
import { deriveCell } from '@/domain/derivation';
import { type CellRules, placeCell } from '@/domain/model/cell';
import type { SourceRuleOf } from '@/domain/model/sourceRule';
import type { ResolvedAmplifySource } from '@/lib/amplify/rowJobs';
import { amplifySnapshot } from '@/query/cache';
import { rootFreshness } from '@/query/intervals';
import { amplifyKey } from '@/query/keys';

import {
  type AccessContext,
  type Part,
  rowParts,
  searchedKeys,
  searchNeeds,
} from './amplifyAccess';
import { type AppState, appState } from './amplifyApp';
import {
  type KeyLabel,
  noAppProblem,
  noAppReason,
  severalProblem,
  skippedRegionsNote,
  unpinNotes,
} from './amplifyProblems';
import { emptyViews, finalView, noAppViews } from './cells';
import { mergeDerivations } from './cellSegments';
import type { Need, RowDerivation } from './need';
import {
  failedDerivation,
  failedViews,
  failureProblem,
  rowProblem,
} from './providerOutcome';
import { isRefreshing, markRefreshing, type RefreshClock } from './refreshing';
import type { CellView } from './types';

/** What every Amplify row derivation shares. */
export interface AmplifyContext extends RefreshClock, AccessContext {
  client: QueryClient;
  rulesFor: (row: AmplifyRow, stageId: string) => CellRules;
  source: SourceRuleOf<'amplify'>;
  /** Names a key in problems. */
  keyLabel: KeyLabel;
}

/** The problem naming the columns of row `rowId` whose cells can't read
 * for want of a key or a secret: dismissable, like the other credential
 * problems (Decision 48), since a session-only secret raises it after
 * every reload. Its id names the row, the columns and what's missing, not
 * the key. */
const unresolvedProblem = (
  rowId: string,
  missing: 'key' | 'secret',
  stages: readonly Stage[],
) =>
  rowProblem(
    rowId,
    `${stages.map((s) => s.name).join(', ')} ${
      missing === 'key'
        ? 'have no AWS key: set one for the row or its columns'
        : "need their AWS key's secret"
    }, so those cells don't show`,
    true,
    { kind: 'settings', place: { level: 'row', rowId }, field: 'awsKey' },
  );

/** The queries the apps need, polling fast while the row is `active`. */
const appNeeds = (states: readonly AppState[], active: boolean): Need[] =>
  states.flatMap((state) =>
    state.requests.map((request) => ({
      key: amplifyKey(state.credentialId, request),
      freshness: rootFreshness(active, false),
    })),
  );

/** The cells in `stages` of `row`, reading `apps`. */
function deriveApps(
  ctx: AmplifyContext,
  row: AmplifyRow,
  apps: readonly ResolvedAmplifySource[],
  stages: readonly Stage[],
): RowDerivation {
  const setFor = (stageId: string) => ctx.rulesFor(row, stageId).set;
  const states = apps.map((app) => appState(ctx.client, app, ctx.source));
  const failedAt = states.findIndex((s) => s.failure);
  const failure = states[failedAt]?.failure;
  if (failure)
    return failedDerivation(
      failure,
      { id: row.id, stages },
      setFor,
      `Amplify app ${apps[failedAt]?.appId ?? ''}`,
      appNeeds(states, false),
    );
  const records = states.flatMap((s) => s.records);
  const complete = states.every((s) => s.complete);
  const updatedAt =
    states.length > 0 ? Math.min(...states.map((s) => s.updatedAt)) : 0;
  const derived: Record<string, CellView> = {};
  for (const stage of stages) {
    const rules = ctx.rulesFor(row, stage.id);
    const placed =
      rules.stage === undefined ? undefined : placeCell(records, rules);
    if (!complete && !placed) continue;
    const view = finalView(
      deriveCell({ placed, set: rules.set, credentialStatus: 'ok' }),
    );
    derived[stage.id] = { ...view, pending: !complete };
  }
  const active = Object.values(derived).some((c) => c.active);
  const freshness = rootFreshness(active, false);
  const cells = markRefreshing(
    derived,
    states.some((s) =>
      s.requests.some((request) =>
        isRefreshing(
          amplifySnapshot(ctx.client, s.credentialId, request),
          freshness,
          ctx,
        ),
      ),
    ),
  );
  return {
    cells,
    needs: appNeeds(states, active),
    problems: [],
    ...(updatedAt > 0 ? { refreshedAt: updatedAt } : {}),
  };
}

/** The part `part` of `row` derived, unless its key or secret is
 * missing. */
function derivePart(
  ctx: AmplifyContext,
  row: AmplifyRow,
  { stages, access }: Part,
): RowDerivation {
  const empty: RowDerivation = { cells: {}, needs: [], problems: [] };
  const setFor = (stageId: string) => ctx.rulesFor(row, stageId).set;
  switch (access.kind) {
    case 'missing':
      return { ...empty, cells: emptyViews(stages, setFor, 'missing') };
    case 'searching':
      return empty;
    case 'failed': {
      const problem = failureProblem(
        access.outcome,
        row.id,
        `the Amplify apps of the AWS key ${ctx.keyLabel(access.key)} in ${access.region}`,
      );
      return {
        ...empty,
        cells: failedViews(access.outcome, stages, setFor),
        problems: problem ? [problem] : [],
      };
    }
    case 'none':
      return {
        ...empty,
        cells: noAppViews(stages, noAppReason(row)),
        problems: [noAppProblem(row, access.key, stages, ctx.keyLabel)],
      };
    case 'apps': {
      const derived = deriveApps(ctx, row, access.apps, stages);
      const { search } = access;
      return search && search.found.length > 1
        ? {
            ...derived,
            problems: [
              ...derived.problems,
              severalProblem(row.id, access.key, search, ctx.keyLabel),
            ],
          }
        : derived;
    }
  }
}

/** `row` derived from the cache: one part per AWS key its cells resolve
 * to, merged, with the search's queries and notes for every key. */
export function deriveAmplifyRow(
  ctx: AmplifyContext,
  row: AmplifyRow,
): RowDerivation {
  const parts = rowParts(ctx, row);
  const merged = mergeDerivations(parts.map((p) => derivePart(ctx, row, p)));
  const unresolved = (['key', 'secret'] as const).flatMap((missing) => {
    const stages = parts.flatMap((p) =>
      p.access.kind === 'missing' && p.access.missing === missing
        ? p.stages
        : [],
    );
    return stages.length > 0
      ? [unresolvedProblem(row.id, missing, stages)]
      : [];
  });
  const regionNotes = searchedKeys(ctx, parts).flatMap((key) => {
    const search = ctx.search(key).state;
    return search.kind === 'done'
      ? skippedRegionsNote(key, search.noted, ctx.keyLabel)
      : [];
  });
  return {
    ...merged,
    needs: [...merged.needs, ...searchNeeds(ctx, parts)],
    problems: [
      ...unresolved,
      ...merged.problems,
      ...unpinNotes(ctx, row, parts, ctx.keyLabel),
      ...regionNotes,
    ],
  };
}
