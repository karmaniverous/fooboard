/**
 * The Amplify apps the picker listed (spec.md C-21, Decision 21): each
 * with its region and the GitHub repo it builds from. Choosing an app
 * with a repo adds it; choosing one without a connected GitHub repo asks
 * for the repo, which can be typed in (`owner/name`) or left empty (the
 * row then shows no behind or diverged badges).
 *
 * @module
 */
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RepoSchema } from '@/domain/config/row';

/** A listed app: where it is, and the GitHub repo it builds from. */
export interface ListedApp {
  appId: string;
  name: string;
  region: string;
  repo?: string;
}

const listKey = (a: ListedApp): string => `${a.region}/${a.appId}`;

export function AmplifyAppList({
  apps,
  onPick,
}: {
  apps: readonly ListedApp[];
  /** Add `app`, building from `repo` (none: no badges). */
  onPick: (app: ListedApp, repo: string | undefined) => void;
}): React.JSX.Element {
  // The app without a repo whose repo is being asked for.
  const [asking, setAsking] = useState<string | undefined>();
  return (
    <ul className="max-h-48 overflow-y-auto">
      {apps.length === 0 && <li>No apps in any Amplify region.</li>}
      {apps.map((a) => (
        <li key={listKey(a)}>
          <button
            type="button"
            aria-expanded={a.repo ? undefined : asking === listKey(a)}
            className="w-full rounded px-2 py-1 text-left hover:bg-muted"
            onClick={() => {
              if (a.repo) onPick(a, a.repo);
              else setAsking(asking === listKey(a) ? undefined : listKey(a));
            }}
          >
            {a.name} <span className="font-mono">{a.region}</span>{' '}
            <span className="text-muted-foreground">
              ({a.repo ?? 'no GitHub repo'})
            </span>
          </button>
          {asking === listKey(a) && (
            <RepoForApp
              app={a}
              onAdd={(repo) => {
                setAsking(undefined);
                onPick(a, repo);
              }}
            />
          )}
        </li>
      ))}
    </ul>
  );
}

/** The GitHub repo for an app without one: typed in, or left empty. */
function RepoForApp({
  app,
  onAdd,
}: {
  app: ListedApp;
  onAdd: (repo: string | undefined) => void;
}): React.JSX.Element {
  const [typed, setTyped] = useState('');
  const repo = typed.trim();
  const valid = repo === '' || RepoSchema.safeParse(repo).success;
  return (
    <form
      className="flex flex-wrap items-center gap-1 px-2 py-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) onAdd(repo || undefined);
      }}
    >
      <Input
        aria-label={`GitHub repo for ${app.name}`}
        aria-invalid={!valid}
        placeholder="owner/name (optional)"
        className="h-8 w-48 text-xs"
        value={typed}
        onChange={(e) => {
          setTyped(e.target.value);
        }}
      />
      <Button type="submit" size="sm" variant="outline" disabled={!valid}>
        Add {app.name}
      </Button>
      <span className="text-muted-foreground">
        {valid
          ? 'Leave it empty for no behind or diverged badges.'
          : 'Type the repo as owner/name, or leave it empty.'}
      </span>
    </form>
  );
}
