/**
 * One Amplify row derived from the cache (spec.md §3.1, §2.3, §3.12):
 * each cell reads the pinned apps serving the AWS key it resolves to
 * (`pinsFor`), so the row's columns derive in parts, one per key, and
 * merge. A cell shows as soon as a landed record places it; until every
 * app its part reads has landed it is not settled, and a cell no landed
 * record places stays loading. A cell whose key can't be resolved (none
 * set at any level, or no secret entered) shows *Needs credential*, with
 * one dismissable problem per missing kind naming the row's columns
 * (Decisions 21, 48). A failed read of one app shows on the cells reading
 * that app only. A part is refreshing while any of its apps' reads has
 * been fetching longer than the refreshing delay or is older than its
 * poll interval (Decisions 46, 47). Pure.
 *
 * @module
 */
import type { QueryClient } from '@tanstack/query-core';

import type { AmplifyRow } from '@/domain/config/row';
import type { Stage } from '@/domain/config/stage';
import { deriveCell } from '@/domain/derivation';
import { type CellRules, placeCell } from '@/domain/model/cell';
import type { SourceRuleOf } from '@/domain/model/sourceRule';
import { pinsFor } from '@/domain/settings/pins';
import { appKey, type ResolvedAmplifySource } from '@/lib/amplify/rowJobs';
import { amplifySnapshot } from '@/query/cache';
import { rootFreshness } from '@/query/intervals';
import { amplifyKey } from '@/query/keys';

import { type AppState, appState } from './amplifyApp';
import { emptyViews, finalView } from './cells';
import { mergeDerivations, type Segment, segments } from './cellSegments';
import type { Need, RowDerivation } from './need';
import { failedDerivation, rowProblem } from './providerOutcome';
import { isRefreshing, markRefreshing, type RefreshClock } from './refreshing';
import type { CellView } from './types';

/** What every Amplify row derivation shares. */
export interface AmplifyContext extends RefreshClock {
  client: QueryClient;
  stages: readonly Stage[];
  rulesFor: (row: AmplifyRow, stageId: string) => CellRules;
  /** The AWS key a row's cell resolves to (spec.md §3.11). */
  keyFor: (row: AmplifyRow, stageId: string) => string | undefined;
  /** A secret is entered for the AWS credential. */
  hasReader: (credentialId: string) => boolean;
  source: SourceRuleOf<'amplify'>;
}

/** What a part of a row reads: its apps, or why it can't. */
type Access =
  | { kind: 'apps'; apps: ResolvedAmplifySource[] }
  /** `key`: none set at any level; `secret`: none entered for it. */
  | { kind: 'missing'; missing: 'key' | 'secret' };

/** What a cell resolving to `key` reads. */
const accessFor = (
  ctx: Pick<AmplifyContext, 'hasReader'>,
  row: AmplifyRow,
  key: string | undefined,
): Access =>
  key === undefined
    ? { kind: 'missing', missing: 'key' }
    : ctx.hasReader(key)
      ? {
          kind: 'apps',
          apps: pinsFor(row, key).map((pin) => ({ ...pin, credentialId: key })),
        }
      : { kind: 'missing', missing: 'secret' };

/** `row`'s columns split by the key their cells resolve to. */
const keySegments = (
  ctx: Pick<AmplifyContext, 'stages' | 'keyFor'>,
  row: AmplifyRow,
): Segment<string | undefined>[] =>
  segments(ctx.stages, (stageId) => ctx.keyFor(row, stageId));

/** Every app any cell of `row` reads, once each. */
export function rowApps(
  ctx: Pick<AmplifyContext, 'stages' | 'keyFor' | 'hasReader'>,
  row: AmplifyRow,
): ResolvedAmplifySource[] {
  const apps = keySegments(ctx, row).flatMap(({ key }) => {
    const access = accessFor(ctx, row, key);
    return access.kind === 'apps' ? access.apps : [];
  });
  return apps.filter(
    (app, i) => apps.findIndex((a) => appKey(a) === appKey(app)) === i,
  );
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

/** `row` derived from the cache: one part per AWS key its cells resolve
 * to, merged. */
export function deriveAmplifyRow(
  ctx: AmplifyContext,
  row: AmplifyRow,
): RowDerivation {
  const setFor = (stageId: string) => ctx.rulesFor(row, stageId).set;
  const unresolved: Record<'key' | 'secret', Stage[]> = { key: [], secret: [] };
  const parts = keySegments(ctx, row).map(({ key, stages }) => {
    const access = accessFor(ctx, row, key);
    if (access.kind === 'apps')
      return deriveApps(ctx, row, access.apps, stages);
    unresolved[access.missing].push(...stages);
    return {
      cells: emptyViews(stages, setFor, 'missing'),
      needs: [],
      problems: [],
    };
  });
  const merged = mergeDerivations(parts);
  const problems = (['key', 'secret'] as const).flatMap((missing) =>
    unresolved[missing].length > 0
      ? [unresolvedProblem(row.id, missing, unresolved[missing])]
      : [],
  );
  return { ...merged, problems: [...problems, ...merged.problems] };
}
