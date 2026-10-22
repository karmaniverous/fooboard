/**
 * One Amplify row derived from the cache (spec.md §3.1, §2.3): the apps
 * it reads (each with its credential resolved), their records placed in
 * the row's cells. A cell shows as soon as a landed record places it;
 * until every app's reads have landed it is not settled, and a cell no
 * landed record places stays loading. A failed read of one app shows on
 * the rows reading that app only. Pure.
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
import { rootFreshness } from '@/query/intervals';
import { amplifyKey } from '@/query/keys';

import { type AppState, appState } from './amplifyApp';
import { emptyViews, finalView } from './cells';
import type { Need, RowDerivation } from './need';
import { failedViews, failureProblem } from './providerOutcome';
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
  openedAt: number;
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
  if (failure) {
    const note = failureProblem(
      failure,
      row.id,
      `Amplify app ${apps[failedAt]?.appId ?? ''}`,
    );
    return {
      cells: failedViews(failure, ctx.stages, setFor),
      needs: appNeeds(states, false),
      problems: note ? [note] : [],
    };
  }
  const records = states.flatMap((s) => s.records);
  const complete = states.every((s) => s.complete);
  const updatedAt =
    states.length > 0 ? Math.min(...states.map((s) => s.updatedAt)) : 0;
  const refreshing = updatedAt > 0 && updatedAt < ctx.openedAt;
  const cells: Record<string, CellView> = {};
  for (const stage of ctx.stages) {
    const rules = ctx.rulesFor(row, stage.id);
    const placed =
      rules.stage === undefined ? undefined : placeCell(records, rules);
    if (!complete && !placed) continue;
    const view = finalView(
      deriveCell({ placed, set: rules.set, credentialStatus: 'ok' }),
    );
    cells[stage.id] = {
      ...view,
      pending: !complete,
      ...(refreshing ? { refreshing } : {}),
    };
  }
  const active = Object.values(cells).some((c) => c.active);
  return {
    cells,
    needs: appNeeds(states, active),
    problems: [],
    ...(updatedAt > 0 ? { refreshedAt: updatedAt } : {}),
  };
}
