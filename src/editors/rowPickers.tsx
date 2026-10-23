/**
 * The row editor's Amplify app picker (spec.md C-21, via `ListApps`). The
 * GitHub repo picker is in `RepoPicker`; an Amplify row's sources are
 * edited in `AmplifySources`.
 *
 * @module
 */
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resolveCredentialId } from '@/domain/config/credentialRefs';
import type { Dashboard } from '@/domain/config/dashboard';
import type { AmplifyRow } from '@/domain/config/row';
import { fetchApps } from '@/query/lookups';
import { useQueryEnv } from '@/query/queryEnvContext';

import { CredentialSelect } from './CredentialSelect';
import { repoFromUrl, uniqueId } from './edit';
import { LoadStatus } from './LoadStatus';
import { useLoadFor } from './useLoad';

/** The region the app picker lists first: AWS's default region. */
const DEFAULT_PICKER_REGION = 'us-east-1';

export function AmplifyPicker({
  dashboard,
  onAdd,
}: {
  dashboard: Dashboard;
  onAdd: (row: AmplifyRow) => void;
}): React.JSX.Element {
  const [credentialId, setCredentialId] = useState<string | undefined>();
  const [region, setRegion] = useState(DEFAULT_PICKER_REGION);
  // Results and the add action use the key and region they were listed
  // with; changing either hides them until the list is fetched again.
  const [apps, load] = useLoadFor<
    { credentialId: string | undefined; region: string },
    { appId: string; name: string; repo?: string }[]
  >({ credentialId, region: region.trim() });
  const resolved = resolveCredentialId(
    dashboard.defaultCredentials,
    'aws',
    credentialId,
  );
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
          label="AWS key for the new Amplify row"
        />
        <Input
          aria-label="Region"
          className="h-8 w-32 text-xs"
          value={region}
          onChange={(e) => {
            setRegion(e.target.value);
          }}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!key || !region.trim()}
          onClick={() => {
            if (!key) return;
            load(async ({ region: listedIn }) =>
              (await fetchApps(env.client, key, listedIn)).flatMap((a) =>
                a.appId
                  ? [
                      {
                        appId: a.appId,
                        name: a.name ?? a.appId,
                        repo: repoFromUrl(a.repository),
                      },
                    ]
                  : [],
              ),
            );
          }}
        >
          List Amplify apps
        </Button>
      </div>
      <LoadStatus state={apps} loading="Loading apps…" />
      {apps.kind === 'done' && (
        <ul className="max-h-48 overflow-y-auto">
          {apps.value.value.length === 0 && (
            <li>No apps in {apps.value.context.region}.</li>
          )}
          {apps.value.value.map((a) => (
            <li key={a.appId}>
              <button
                type="button"
                disabled={!a.repo}
                className="w-full rounded px-2 py-1 text-left hover:bg-muted disabled:opacity-50"
                onClick={() => {
                  if (!a.repo) return;
                  onAdd({
                    type: 'amplify',
                    id: uniqueId(
                      a.name,
                      dashboard.rows.map((r) => r.id),
                    ),
                    repo: a.repo,
                    displayName: a.name,
                    sources: [
                      {
                        credentialId: apps.value.context.credentialId,
                        region: apps.value.context.region,
                        appId: a.appId,
                      },
                    ],
                    stageRules: {},
                    cellStatusSets: {},
                  });
                }}
              >
                {a.name}{' '}
                <span className="text-muted-foreground">
                  ({a.repo ?? 'no repo'})
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
