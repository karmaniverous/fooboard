/**
 * Where the app goes after an import (spec.md §3.8; spec 0.2.0 §3.J *Keys
 * on arrival*): the imported dashboard when there was one, else the home
 * page. When any of that dashboard's credentials has no secret on this
 * device (as when an assistant built the share, which never carries
 * keys), the board opens with the credentials panel open on the first of
 * them in the panel's order, by name, so fooboard asks for its key. Pure.
 *
 * @module
 */
import { sortCredentials } from '@/credentials/credentialOrder';
import type { Dashboard } from '@/domain/config/dashboard';
import { openCredentialState } from '@/firstRun/paths';
import { dashboardPath, HOME_PATH } from '@/pages/paths';

import type { ImportPlan } from './importPlan';

/** A route, and the router state to open it with. */
export interface Landing {
  path: string;
  state?: ReturnType<typeof openCredentialState>;
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
  return {
    path: dashboardPath(only),
    ...(ask ? { state: openCredentialState(ask.id) } : {}),
  };
}
