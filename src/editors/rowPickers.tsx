/**
 * The row editor's Amplify app picker (spec.md C-21, §3.1, §3.12,
 * Decision 21): an AWS key's apps in every Amplify Hosting region, one
 * `ListApps` query per region (the board's app search), each app shown
 * with its region. A picked app with a repo makes a row found by repo
 * when it is the only app building that repo under the key; otherwise
 * the app is pinned under the key. A key chosen here rather than
 * inherited becomes the row's `awsKey`. The GitHub repo picker is
 * in `RepoPicker`; the listed apps and adding one are in `AmplifyAppList`;
 * an Amplify row's pinned apps are edited in `PinnedApps`.
 *
 * @module
 */
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import type { Dashboard } from '@/domain/config/dashboard';
import type { AmplifyRow } from '@/domain/config/row';
import { repoFromUrl, sameRepo } from '@/domain/matching';
import type { RegionApp } from '@/lib/amplify/regions';
import { fetchAppsAcrossRegions } from '@/query/lookups';
import { useQueryEnv } from '@/query/queryEnvContext';

import { AmplifyAppList, type ListedApp } from './AmplifyAppList';
import { CredentialSelect } from './CredentialSelect';
import { dashboardDefault } from './dashboardDefault';
import { rowFromApp } from './edit';
import { LoadStatus } from './LoadStatus';
import { useLoadFor } from './useLoad';

/** The listed apps that have an id, with the GitHub repo each builds from
 * (none for an app without a connected GitHub repo). */
const listedApps = (found: readonly RegionApp[]): ListedApp[] =>
  found.flatMap(({ region, app }) =>
    app.appId
      ? [
          {
            appId: app.appId,
            name: app.name ?? app.appId,
            region,
            repo: repoFromUrl(app.repository),
          },
        ]
      : [],
  );

export function AmplifyPicker({
  dashboard,
  onAdd,
}: {
  dashboard: Dashboard;
  onAdd: (row: AmplifyRow) => void;
}): React.JSX.Element {
  const [credentialId, setCredentialId] = useState<string | undefined>();
  // Results and the add action use the key they were listed with;
  // changing it hides them until the list is fetched again.
  const unset = dashboardDefault(dashboard, 'aws');
  const resolved = credentialId ?? unset.id;
  // An app is pinned under the key it was listed with (spec.md §3.12).
  const [apps, load] = useLoadFor<
    { credentialId: string | undefined; chosen: boolean },
    ListedApp[]
  >({ credentialId: resolved, chosen: credentialId !== undefined });
  const env = useQueryEnv();
  const key =
    resolved && env.providers.amplify(resolved) ? resolved : undefined;
  if (!dashboard.credentials.some((c) => c.kind === 'aws')) {
    return (
      <p className="text-xs text-muted-foreground">
        Add an AWS key (Credentials) to add Amplify rows.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="flex flex-wrap items-center gap-1">
        <CredentialSelect
          dashboard={dashboard}
          kind="aws"
          value={credentialId}
          onChange={setCredentialId}
          unset={unset}
          label="AWS key for the new Amplify row"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!key}
          onClick={() => {
            if (!key) return;
            load(async () =>
              listedApps(await fetchAppsAcrossRegions(env.client, key)),
            );
          }}
        >
          List Amplify apps
        </Button>
      </div>
      <LoadStatus state={apps} loading="Loading apps in every region…" />
      {apps.kind === 'done' && (
        <AmplifyAppList
          apps={apps.value.value}
          onPick={(app, repo) => {
            const { context, value: listed } = apps.value;
            const builders = repo
              ? listed.filter((a) => a.repo && sameRepo(a.repo, repo))
              : [];
            onAdd(
              rowFromApp(app, dashboard, {
                credentialId: context.credentialId,
                repo,
                pinned: builders.length !== 1,
                awsKey: context.chosen ? context.credentialId : undefined,
              }),
            );
          }}
        />
      )}
    </div>
  );
}
