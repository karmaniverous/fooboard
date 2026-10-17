/**
 * The row editor's pickers (spec.md C-21): credential choice, the GitHub
 * repo picker, the Amplify app picker (via `ListApps`), and extra
 * Amplify sources.
 *
 * @module
 */
import { useState } from 'react';

import { NativeSelect } from '@/components/NativeSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resolveCredentialId } from '@/domain/config/credentialRefs';
import type { CredentialKind } from '@/domain/config/credentials';
import type { Dashboard } from '@/domain/config/dashboard';
import type { AmplifyRow } from '@/domain/config/row';
import type { EngineProviders } from '@/engine';

import { repoFromUrl, uniqueId } from './edit';
import { LoadStatus } from './LoadStatus';
import { useLoad } from './useLoad';

/** A credential choice: the dashboard default, or one of its credentials. */
export function CredentialSelect({
  dashboard,
  kind,
  value,
  onChange,
  label,
}: {
  dashboard: Dashboard;
  kind: CredentialKind;
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  label: string;
}): React.JSX.Element {
  return (
    <NativeSelect
      aria-label={label}
      className="h-8 px-1 text-xs"
      value={value ?? ''}
      onChange={(e) => {
        onChange(e.target.value || undefined);
      }}
    >
      <option value="">Dashboard default</option>
      {dashboard.credentials
        .filter((c) => c.kind === kind)
        .map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
    </NativeSelect>
  );
}

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
  const taken = new Set(dashboard.rows.map((r) => r.repo));
  return (
    <div className="flex flex-col gap-1">
      {repos.kind === 'idle' && (
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
          Add a GitHub row
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
              .filter(
                (r) =>
                  !taken.has(r) &&
                  r.toLowerCase().includes(query.toLowerCase()),
              )
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
  const [apps, load] =
    useLoad<{ appId: string; name: string; repo?: string }[]>();
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
      <div className="flex items-center gap-1">
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
            const reader = readers({
              credentialId: resolved,
              region: region.trim(),
            });
            load(async () =>
              (await reader.listApps()).flatMap((a) =>
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
          {apps.value.length === 0 && <li>No apps in {region}.</li>}
          {apps.value.map((a) => (
            <li key={a.appId}>
              <button
                type="button"
                disabled={!a.repo}
                title={a.repo ? undefined : 'Not connected to a GitHub repo'}
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
                      { credentialId, region: region.trim(), appId: a.appId },
                    ],
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
}: {
  dashboard: Dashboard;
  name: string;
  onAdd: (source: AmplifyRow['sources'][number]) => void;
}): React.JSX.Element {
  const [credentialId, setCredentialId] = useState<string | undefined>();
  const [region, setRegion] = useState('');
  const [appId, setAppId] = useState('');
  return (
    <form
      className="flex items-center gap-1"
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
