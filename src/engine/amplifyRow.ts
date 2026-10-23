/**
 * One Amplify row derived from the cache (spec.md §3.1, §2.3): the apps
 * it reads (each with its credential resolved), their records placed in
 * the row's cells. A cell shows as soon as a landed record places it;
 * until every app's reads have landed it is not settled, and a cell no
 * landed record places stays loading. A failed read of one app shows on
 * the rows reading that app only. The whole row is refreshing while any
 * of its apps' reads is fetching or older than its poll interval
 * (Decision 46). Pure.
 *
 * @module
 */
import type { QueryClient } from '@tanstack/query-core';

import {
  type DefaultCredentials,
  resolveCredentialId,
} from '@/domain/config/credentialRefs';
import type { AmplifyRow } from '@/domain/config/row';
import type { Stage } from '@/domain/config/stage';
import { deriveCell } from '@/domain/derivation';
import { type CellRules, placeCell } from '@/domain/model/cell';
import type { SourceRuleOf } from '@/domain/model/sourceRule';
import type { ResolvedAmplifySource } from '@/lib/amplify/rowJobs';
import { amplifySnapshot } from '@/query/cache';
import { rootFreshness } from '@/query/intervals';
import { amplifyKey } from '@/query/keys';

import { type AppState, appState } from './amplifyApp';
import { emptyViews, finalView } from './cells';
import type { Need, RowDerivation } from './need';
import { failedDerivation } from './providerOutcome';
import { isRefreshing, markRefreshing } from './refreshing';
import type { CellView } from './types';

/** What every Amplify row derivation shares. */
export interface AmplifyContext {
  client: QueryClient;
  stages: readonly Stage[];
  rulesFor: (row: AmplifyRow, stageId: string) => CellRules;
  defaultsFor: (row: AmplifyRow) => DefaultCredentials;
  /** A secret is entered for the AWS credential. */
  hasReader: (credentialId: string) => boolean;
  source: SourceRuleOf<'amplify'>;
  /** When the row is derived: data older than its poll interval is
   * refreshing (Decision 46). */
  now: number;
}

/** A row's apps with their credentials, or `undefined` when one has no
 * credential or no secret. */
export function resolvedSources(
  ctx: Pick<AmplifyContext, 'defaultsFor' | 'hasReader'>,
  row: AmplifyRow,
): ResolvedAmplifySource[] | undefined {
  const out: ResolvedAmplifySource[] = [];
  for (const s of row.sources) {
    const credentialId = resolveCredentialId(
      ctx.defaultsFor(row),
      'aws',
      s.credentialId,
    );
    if (!credentialId || !ctx.hasReader(credentialId)) return undefined;
    out.push({ ...s, credentialId });
  }
  return out;
}

/** The queries the apps need, polling fast while the row is `active`. */
const appNeeds = (states: readonly AppState[], active: boolean): Need[] =>
  states.flatMap((state) =>
    state.requests.map((request) => ({
      key: amplifyKey(state.credentialId, request),
      freshness: rootFreshness(active, false),
    })),
  );

/** `row` derived from the cache. */
export function deriveAmplifyRow(
  ctx: AmplifyContext,
  row: AmplifyRow,
): RowDerivation {
  const setFor = (stageId: string) => ctx.rulesFor(row, stageId).set;
  const apps = resolvedSources(ctx, row);
  if (!apps)
    return {
      cells: emptyViews(ctx.stages, setFor, 'missing'),
      needs: [],
      problems: [],
    };
  const states = apps.map((app) => appState(ctx.client, app, ctx.source));
  const failedAt = states.findIndex((s) => s.failure);
  const failure = states[failedAt]?.failure;
  if (failure)
    return failedDerivation(
      failure,
      { id: row.id, stages: ctx.stages },
      setFor,
      `Amplify app ${apps[failedAt]?.appId ?? ''}`,
      appNeeds(states, false),
    );
  const records = states.flatMap((s) => s.records);
  const complete = states.every((s) => s.complete);
  const updatedAt =
    states.length > 0 ? Math.min(...states.map((s) => s.updatedAt)) : 0;
  const derived: Record<string, CellView> = {};
  for (const stage of ctx.stages) {
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
          ctx.now,
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
