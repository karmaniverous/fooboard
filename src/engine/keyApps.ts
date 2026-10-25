/**
 * The Amplify apps the board reads with each AWS key (spec.md §3.12
 * *IAM*), for *Copy AWS policy* on that key: its pins plus the apps its
 * current search finds for the board's rows, once each. A key whose
 * search hasn't finished has no entry, so the policy stays account-wide
 * until the board has read with it. Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';

import { rowParts, searchedKeys } from './amplifyAccess';
import { amplifyContext, type DeriveEnv } from './rowDerive';

/** An app named by region and id (not yet validated for a policy). */
export interface KeyApp {
  region: string;
  appId: string;
}

/** The apps each searched AWS key reads, by credential id. */
export function keyApps(
  env: DeriveEnv,
  dashboard: Dashboard,
): Record<string, KeyApp[]> {
  const ctx = amplifyContext(env, dashboard);
  const out = new Map<string, Map<string, KeyApp>>();
  for (const row of dashboard.rows) {
    if (row.type !== 'amplify') continue;
    const parts = rowParts(ctx, row);
    for (const key of searchedKeys(ctx, parts)) {
      if (ctx.search(key).state.kind !== 'done') continue;
      const apps = out.get(key) ?? new Map<string, KeyApp>();
      out.set(key, apps);
      const add = ({ region, appId }: KeyApp) =>
        apps.set(JSON.stringify([region, appId]), { region, appId });
      // A part's apps are its pins for the key when it has any (a pin
      // keyed to the key is always among them), else the search's.
      for (const { access } of parts)
        if (access.kind === 'apps' && access.key === key)
          access.apps.forEach(add);
    }
  }
  return Object.fromEntries(
    [...out].map(([key, apps]) => [key, [...apps.values()]]),
  );
}
