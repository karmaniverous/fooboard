/**
 * Rows (spec.md C-21): add a GitHub row by picking a repo the dashboard's
 * token can see (display name defaults to the repo without its owner), or
 * an Amplify row by choosing credential, region and app (listed via
 * `ListApps`); rename, reorder, remove; per-row token override, row key
 * tests, extra Amplify sources and the divider before each row.
 *
 * @module
 */
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resolveCredentialId } from '@/domain/config/credentialRefs';
import type { CredentialKind } from '@/domain/config/credentials';
import type { Dashboard } from '@/domain/config/dashboard';
import type { MatchTest } from '@/domain/config/matchTest';
import type { AmplifyRow, Row } from '@/domain/config/row';
import type { EngineProviders } from '@/engine';

import {
  removeRow,
  repoFromUrl,
  rowFromRepo,
  setDivider,
  uniqueId,
} from './edit';
import { CommitInput, DividerControl } from './fields';
import { MatchTestsEditor } from './MatchTestsEditor';
import { ReorderList } from './ReorderList';
import { useLoad } from './useLoad';

/** A credential choice: the dashboard default, or one of its credentials. */
function CredentialSelect({
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
    <select
      aria-label={label}
      className="h-8 rounded-md border bg-background px-1 text-xs"
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
    </select>
  );
}

function RepoPicker({
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
      {repos.kind === 'loading' && <p className="text-xs">Loading repos…</p>}
      {repos.kind === 'error' && (
        <p role="alert" className="text-xs text-status-failure">
          {repos.message}
        </p>
      )}
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

function AmplifyPicker({
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
      {apps.kind === 'loading' && <p>Loading apps…</p>}
      {apps.kind === 'error' && (
        <p role="alert" className="text-status-failure">
          {apps.message}
        </p>
      )}
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

function AddSource({
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

export function RowsEditor({
  dashboard,
  providers,
  onChange,
  draft,
}: {
  dashboard: Dashboard;
  providers: EngineProviders;
  onChange: (dashboard: Dashboard) => void;
  /** A row key test to pre-fill on one row. */
  draft?: { rowId: string; test: MatchTest };
}): React.JSX.Element {
  const replaceRow = (row: Row) => {
    onChange({
      ...dashboard,
      rows: dashboard.rows.map((r) => (r.id === row.id ? row : r)),
    });
  };
  return (
    <div className="flex flex-col gap-3 text-sm">
      <ReorderList
        items={dashboard.rows}
        keyOf={(r) => r.id}
        nameOf={(r) => r.displayName}
        onReorder={(rows) => {
          onChange({ ...dashboard, rows });
        }}
        onRemove={(r) => {
          onChange(removeRow(dashboard, r.id));
        }}
      >
        {(row) => (
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex items-center gap-1">
              <CommitInput
                label={`Display name for ${row.repo}`}
                className="h-8 text-xs"
                value={row.displayName}
                onCommit={(displayName) => {
                  replaceRow({ ...row, displayName });
                }}
              />
              <span className="shrink-0 text-muted-foreground">
                {row.type === 'amplify' ? 'Amplify · ' : ''}
                {row.repo}
              </span>
            </div>
            <CredentialSelect
              dashboard={dashboard}
              kind="github"
              value={
                row.type === 'github'
                  ? row.credentialId
                  : row.githubCredentialId
              }
              label={`GitHub token for ${row.displayName}`}
              onChange={(id) => {
                replaceRow(
                  row.type === 'github'
                    ? { ...row, credentialId: id }
                    : { ...row, githubCredentialId: id },
                );
              }}
            />
            {row.type === 'github' ? (
              <MatchTestsEditor
                title={`Row key tests for ${row.displayName}`}
                fields={['jobName', 'workflowName']}
                tests={row.rowKeyTests}
                draft={draft?.rowId === row.id ? draft.test : undefined}
                onChange={(rowKeyTests) => {
                  replaceRow({ ...row, rowKeyTests });
                }}
              />
            ) : (
              <div className="flex flex-col gap-1">
                <span className="font-semibold">Sources</span>
                {row.sources.map((s, i) => (
                  <div
                    key={`${s.region}-${s.appId}`}
                    className="flex items-center gap-2"
                  >
                    <span>
                      {s.appId} in {s.region}
                    </span>
                    {row.sources.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          replaceRow({
                            ...row,
                            sources: row.sources.filter((_, j) => j !== i),
                          });
                        }}
                      >
                        Delete source
                      </Button>
                    )}
                  </div>
                ))}
                <AddSource
                  dashboard={dashboard}
                  name={row.displayName}
                  onAdd={(source) => {
                    replaceRow({ ...row, sources: [...row.sources, source] });
                  }}
                />
              </div>
            )}
            <DividerControl
              name={row.displayName}
              divider={dashboard.rowDividers.find((d) => d.beforeId === row.id)}
              onChange={(divider) => {
                onChange({
                  ...dashboard,
                  rowDividers: setDivider(
                    dashboard.rowDividers,
                    row.id,
                    divider,
                  ),
                });
              }}
            />
          </div>
        )}
      </ReorderList>

      <section className="flex flex-col gap-2 rounded-md border p-2">
        <h3 className="font-semibold">Add a row</h3>
        <RepoPicker
          dashboard={dashboard}
          providers={providers}
          onPick={(repo) => {
            onChange({
              ...dashboard,
              rows: [...dashboard.rows, rowFromRepo(repo, dashboard)],
            });
          }}
        />
        <AmplifyPicker
          dashboard={dashboard}
          providers={providers}
          onAdd={(row) => {
            onChange({ ...dashboard, rows: [...dashboard.rows, row] });
          }}
        />
      </section>
    </div>
  );
}
