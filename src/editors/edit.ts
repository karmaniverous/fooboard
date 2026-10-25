/**
 * Pure editing helpers (spec.md C-21): unique ids, rows from picked
 * repos, duplicating a dashboard, and removing rows and stages.
 *
 * @module
 */
import { omit } from 'radash';

import { mapCredentialRefs } from '@/credentials/dashboardCredentials';
import type { Dashboard } from '@/domain/config/dashboard';
import type { AmplifyRow, GithubRow } from '@/domain/config/row';
import { freshId } from '@/lib/ids';

import { tidyGroups } from './groupEdit';

/** A readable id from `base`, made unique among `taken`. */
export function uniqueId(base: string, taken: Iterable<string>): string {
  const slug =
    base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'item';
  return freshId(slug, taken);
}

/** A GitHub row for a picked repo: the display name defaults to the repo
 * name without its owner, and it keeps the token it was picked with as
 * its own setting (unset inherits; spec.md C-21, §3.11). */
export function rowFromRepo(
  fullName: string,
  dashboard: Pick<Dashboard, 'rows'>,
  credentialId?: string,
): GithubRow {
  const name = fullName.split('/')[1] ?? fullName;
  return {
    type: 'github',
    id: uniqueId(
      name,
      dashboard.rows.map((r) => r.id),
    ),
    repo: fullName,
    displayName: name,
    stageRules: {},
    settings: credentialId ? { githubToken: credentialId } : {},
    cellSettings: {},
  };
}

/** How a picked app becomes a row (spec.md §3.12 *Adding a row*). */
export interface PickedApp {
  /** The AWS key the app was listed with. */
  credentialId?: string;
  /** The GitHub repo it builds from, if any. */
  repo?: string;
  /** Pin the app: it has no repo, or isn't the only app building it
   * under the key; otherwise the search finds it from the repo. */
  pinned: boolean;
  /** A key chosen in the picker rather than inherited: the row's own. */
  awsKey?: string;
}

/** An Amplify row for a picked app: named after the app, building from
 * its repo when it has one (spec.md C-21, Decision 21), the app pinned
 * under the key it was listed with when `pinned`, and the chosen key as
 * the row's `awsKey`. */
export function rowFromApp(
  app: { appId: string; name: string; region: string },
  dashboard: Pick<Dashboard, 'rows'>,
  { credentialId, repo, pinned, awsKey }: PickedApp,
): AmplifyRow {
  return {
    type: 'amplify',
    id: uniqueId(
      app.name,
      dashboard.rows.map((r) => r.id),
    ),
    ...(repo ? { repo } : {}),
    displayName: app.name,
    pinnedApps:
      pinned || !repo
        ? [
            {
              region: app.region,
              appId: app.appId,
              ...(credentialId ? { credentialId } : {}),
            },
          ]
        : [],
    stageRules: {},
    settings: awsKey ? { awsKey } : {},
    cellSettings: {},
  };
}

/** A copy under a new id and name. Credentials are re-keyed by `newId`
 * so the copy's secrets are independent (the caller copies them). */
export function duplicateDashboard(
  dashboard: Dashboard,
  id: string,
  name: string,
  newCredentialId: (oldId: string) => string,
): Dashboard {
  const ids = new Map(
    dashboard.credentials.map((c) => [c.id, newCredentialId(c.id)]),
  );
  return {
    ...mapCredentialRefs(structuredClone(dashboard), (ref) => ids.get(ref)),
    id,
    name,
    credentials: dashboard.credentials.map((c) => ({
      ...c,
      id: ids.get(c.id) ?? c.id,
    })),
  };
}

/** Remove a row; its group loses it (and disappears if empty). */
export function removeRow(dashboard: Dashboard, id: string): Dashboard {
  return tidyGroups(
    { ...dashboard, rows: dashboard.rows.filter((r) => r.id !== id) },
    'rows',
  );
}

/** Remove a stage: any stage's use of it as a source, its overrides on
 * rows and row groups (C-14c), its cells' settings (§3.11), and its
 * column-group membership. */
export function removeStage(dashboard: Dashboard, id: string): Dashboard {
  const drop = <T extends { stageRules: Record<string, unknown> }>(
    x: T,
  ): T => ({
    ...x,
    stageRules: omit(x.stageRules, [id]),
  });
  return tidyGroups(
    {
      ...dashboard,
      rows: dashboard.rows.map((r) => ({
        ...drop(r),
        cellSettings: omit(r.cellSettings, [id]),
      })),
      rowGroups: dashboard.rowGroups.map(drop),
      stages: dashboard.stages
        .filter((s) => s.id !== id)
        .map((s) =>
          s.sourceStageId === id ? { ...s, sourceStageId: undefined } : s,
        ),
    },
    'stages',
  );
}
