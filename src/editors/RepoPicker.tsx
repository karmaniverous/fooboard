/**
 * The GitHub repo picker (spec.md C-21): choose the token for the new row
 * (unset follows the dashboard default), list the repos it can see, and
 * pick one. The new row keeps the chosen token.
 *
 * @module
 */
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { resolveCredentialId } from '@/domain/config/credentialRefs';
import type { Dashboard } from '@/domain/config/dashboard';
import { fetchRepos } from '@/query/lookups';
import { useQueryEnv } from '@/query/queryEnvContext';

import { CredentialSelect } from './CredentialSelect';
import { LoadStatus } from './LoadStatus';
import { useLoadFor } from './useLoad';

export function RepoPicker({
  dashboard,
  onPick,
}: {
  dashboard: Dashboard;
  /** The picked repo and the token chosen for it (unset: the default). */
  onPick: (fullName: string, credentialId: string | undefined) => void;
}): React.JSX.Element {
  const [credentialId, setCredentialId] = useState<string | undefined>();
  const [query, setQuery] = useState('');
  // Results belong to the token they were listed with; changing it hides
  // them until they are listed again.
  const [repos, load] = useLoadFor<string | undefined, string[]>(credentialId);
  const resolved = resolveCredentialId(
    dashboard.defaultCredentials,
    'github',
    credentialId,
  );
  const env = useQueryEnv();
  const token =
    resolved && env.providers.github(resolved) ? resolved : undefined;
  if (!dashboard.credentials.some((c) => c.kind === 'github')) {
    return (
      <p className="text-xs text-muted-foreground">
        Add a GitHub token (Credentials) to pick repos.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-1 text-xs">
      <div className="flex flex-wrap items-center gap-1">
        <CredentialSelect
          dashboard={dashboard}
          kind="github"
          value={credentialId}
          onChange={setCredentialId}
          label="GitHub token for the new row"
        />
        {(repos.kind === 'idle' || repos.kind === 'error') && (
          <Button
            size="sm"
            variant="outline"
            disabled={!token}
            onClick={() => {
              if (!token) return;
              load(async () =>
                (await fetchRepos(env.client, token))
                  .map((r) => r.full_name)
                  .sort(),
              );
            }}
          >
            {repos.kind === 'error' ? 'Try again' : 'Add a GitHub row'}
          </Button>
        )}
      </div>
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
          <ul className="max-h-48 overflow-y-auto">
            {repos.value.value
              .filter((r) => r.toLowerCase().includes(query.toLowerCase()))
              .map((r) => (
                <li key={r}>
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1 text-left hover:bg-muted"
                    onClick={() => {
                      onPick(r, repos.value.context);
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
