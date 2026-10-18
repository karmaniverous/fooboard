/**
 * The row editor's pickers (spec.md C-21): the GitHub repo picker, the Amplify app picker (via `ListApps`), and extra
 * Amplify sources.
 *
 * @module
 */
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resolveCredentialId } from '@/domain/config/credentialRefs';
import type { Dashboard } from '@/domain/config/dashboard';
import type { AmplifyRow } from '@/domain/config/row';
import type { EngineProviders } from '@/engine';

import { CredentialSelect, type Inherited } from './CredentialSelect';
import { repoFromUrl, uniqueId } from './edit';
import { LoadStatus } from './LoadStatus';
import { useLoad } from './useLoad';

export function RepoPicker({
  dashboard,
  providers,
  onPick,
}: {
  dashboard: Dashboard;
  providers: EngineProviders;
  onPick: (fullName: string) => void;
}): React.JSX.Element {
  const [repos, load] = useLoad<string[]>();
  const [query, setQuery] = useState('');
  const tokenId = resolveCredentialId(dashboard.defaultCredentials, 'github');
  const reader = tokenId ? providers.github(tokenId) : undefined;
  if (!reader) {
    return (
      <p className="text-xs text-muted-foreground">
        Add a GitHub token (Credentials) to pick repos.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      {(repos.kind === 'idle' || repos.kind === 'error') && (
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => {
            load(async () =>
              (await reader.listRepos()).map((r) => r.full_name).sort(),
            );
          }}
        >
          {repos.kind === 'error' ? 'Try again' : 'Add a GitHub row'}
        </Button>
      )}
      <LoadStatus state={repos} loading="Loading repos…" />
      {repos.kind === 'done' && (
        <>
          <Input
            aria-label="Search repos"
            placeholder="Search repos"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
            }}
          />
          <ul className="max-h-48 overflow-y-auto text-xs">
            {repos.value
              .filter((r) => r.toLowerCase().includes(query.toLowerCase()))
              .map((r) => (
                <li key={r}>
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1 text-left hover:bg-muted"
                    onClick={() => {
                      onPick(r);
                    }}
                  >
                    {r}
                  </button>
                </li>
              ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function AmplifyPicker({
  dashboard,
  providers,
  onAdd,
}: {
  dashboard: Dashboard;
  providers: EngineProviders;
  onAdd: (row: AmplifyRow) => void;
}): React.JSX.Element {
  const [credentialId, setCredentialId] = useState<string | undefined>();
  const [region, setRegion] = useState('us-east-1');
  const [listing, load] = useLoad<{
    credentialId: string | undefined;
    region: string;
    apps: { appId: string; name: string; repo?: string }[];
  }>();
  // Results and the add action use the key and region they were listed
  // with; changing either hides them until the list is fetched again.
  const current =
    listing.kind === 'done' &&
    listing.value.credentialId === credentialId &&
    listing.value.region === region.trim()
      ? listing.value
      : undefined;
  const apps = current
    ? ({ kind: 'done', value: current.apps } as const)
    : listing.kind === 'done'
      ? ({ kind: 'idle' } as const)
      : listing;
  const resolved = resolveCredentialId(
    dashboard.defaultCredentials,
    'aws',
    credentialId,
  );
  const readers = resolved ? providers.amplify(resolved) : undefined;
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
          disabled={!readers || !resolved || !region.trim()}
          onClick={() => {
            if (!readers || !resolved) return;
            const context = { credentialId, region: region.trim() };
            const reader = readers({
              credentialId: resolved,
              region: context.region,
            });
            load(async () => ({
              ...context,
              apps: (await reader.listApps()).flatMap((a) =>
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
            }));
          }}
        >
          List Amplify apps
        </Button>
      </div>
      <LoadStatus state={apps} loading="Loading apps…" />
      {current && apps.kind === 'done' && (
        <ul className="max-h-48 overflow-y-auto">
          {apps.value.length === 0 && <li>No apps in {current.region}.</li>}
          {apps.value.map((a) => (
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
                        credentialId: current.credentialId,
                        region: current.region,
                        appId: a.appId,
                      },
                    ],
                    branchPatternOverrides: {},
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

export function AddSource({
  dashboard,
  onAdd,
  name,
  inherited,
}: {
  dashboard: Dashboard;
  name: string;
  /** What an unset key inherits: the row's group's or the dashboard's. */
  inherited: Inherited;
  onAdd: (source: AmplifyRow['sources'][number]) => void;
}): React.JSX.Element {
  const [credentialId, setCredentialId] = useState<string | undefined>();
  const [region, setRegion] = useState('');
  const [appId, setAppId] = useState('');
  return (
    <form
      className="flex flex-wrap items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        onAdd({ credentialId, region: region.trim(), appId: appId.trim() });
        setRegion('');
        setAppId('');
      }}
    >
      <CredentialSelect
        dashboard={dashboard}
        kind="aws"
        value={credentialId}
        onChange={setCredentialId}
        inherited={inherited}
        label={`AWS key for a new ${name} source`}
      />
      <Input
        aria-label={`Region for a new ${name} source`}
        placeholder="Region"
        className="h-8 text-xs"
        value={region}
        onChange={(e) => {
          setRegion(e.target.value);
        }}
      />
      <Input
        aria-label={`App ID for a new ${name} source`}
        placeholder="App ID"
        className="h-8 text-xs"
        value={appId}
        onChange={(e) => {
          setAppId(e.target.value);
        }}
      />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={!region.trim() || !appId.trim()}
      >
        Add source
      </Button>
    </form>
  );
}
