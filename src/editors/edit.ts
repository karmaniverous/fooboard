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
 * name without its owner, and it keeps the token it was picked with
 * (unset follows the default; spec.md C-21). */
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
    ...(credentialId ? { credentialId } : {}),
    stageRules: {},
    cellStatusSets: {},
  };
}

/** An Amplify row for a picked app: named after the app, reading it with
 * the AWS key it was listed with (unset follows the default), and
 * building from `repo` when it has one (spec.md C-21, Decision 21). */
export function rowFromApp(
  app: { appId: string; name: string; region: string },
  dashboard: Pick<Dashboard, 'rows'>,
  credentialId: string | undefined,
  repo: string | undefined,
): AmplifyRow {
  return {
    type: 'amplify',
    id: uniqueId(
      app.name,
      dashboard.rows.map((r) => r.id),
    ),
    ...(repo ? { repo } : {}),
    displayName: app.name,
    sources: [{ credentialId, region: app.region, appId: app.appId }],
    stageRules: {},
    cellStatusSets: {},
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

/** `owner/name` from an Amplify app's repository URL, if it is GitHub. */
export function repoFromUrl(url: string | undefined): string | undefined {
  const match =
    /^https:\/\/github\.com\/([^/\s]+)\/([^/\s]+?)(?:\.git)?\/?$/.exec(
      url ?? '',
    );
  return match ? `${match[1]}/${match[2]}` : undefined;
}

/** Remove a row; its group loses it (and disappears if empty). */
export function removeRow(dashboard: Dashboard, id: string): Dashboard {
  return tidyGroups(
    { ...dashboard, rows: dashboard.rows.filter((r) => r.id !== id) },
    'rows',
  );
}

/** Remove a stage: any stage's use of it as a source, its overrides on
 * rows and row groups (C-14c), rows' status-set choices for its cells
 * (A§4.3.6), and its column-group membership. */
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
        cellStatusSets: omit(r.cellStatusSets, [id]),
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
