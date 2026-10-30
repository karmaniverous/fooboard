/**
 * Where the app goes after an import (spec.md §3.8; spec 0.2.0 §3.J *Keys
 * on arrival*): the imported dashboard when there was one, else the home
 * page. The board is always opened as an import's arrival, so it shows
 * the imported dashboard even when that replaced the one open. When any
 * of its credentials has no secret on this device (as when an assistant
 * built the share, which never carries keys), the board opens with the
 * credentials panel open on the first of them in the panel's order, by
 * name, so fooboard asks for its key. Pure.
 *
 * @module
 */
import { sortCredentials } from '@/credentials/credentialOrder';
import type { Dashboard } from '@/domain/config/dashboard';
import { type ImportArrival, importArrivalState } from '@/firstRun/paths';
import { dashboardPath, HOME_PATH } from '@/pages/paths';

import type { ImportPlan } from './importPlan';

/** A route, and the router state to open it with. */
export interface Landing {
  path: string;
  state?: ImportArrival;
}

/** Where to go after `plan` is applied: `hasSecret` says whether this
 * device holds a credential's secret. */
export function landingAfter(
  plan: Pick<ImportPlan, 'dashboards' | 'imported'>,
  hasSecret: (credentialId: string) => boolean,
): Landing {
  if (plan.imported.length !== 1) return { path: HOME_PATH };
  const [only] = plan.imported;
  const dashboard: Dashboard | undefined = plan.dashboards.find(
    (d) => d.id === only,
  );
  const ask = sortCredentials(dashboard?.credentials ?? []).find(
    (c) => !hasSecret(c.id),
  );
  return { path: dashboardPath(only), state: importArrivalState(ask?.id) };
}
