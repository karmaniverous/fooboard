/**
 * First run, step 2 (spec.md §3.9, C-22): the repos the dashboard's token
 * can see, listed as the step opens, each ticked to become a row. Going
 * on saves a GitHub row per ticked repo (`rowFromRepo`, reading with the
 * dashboard's token) and drops the rows of repos unticked since, then
 * opens the stages step.
 *
 * @module
 */
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { ActionError } from '@/components/ActionError';
import { CheckField } from '@/components/CheckField';
import { ExternalLink } from '@/components/ExternalLink';
import { Button } from '@/components/ui/button';
import { useActionError } from '@/components/useActionError';
import { LoadStatus } from '@/editors/LoadStatus';
import { RepoList } from '@/editors/RepoList';
import { useLoad } from '@/editors/useLoad';
import { readmeSection } from '@/lib/site';
import { fetchRepoNames } from '@/query/lookups';
import { useQueryEnv } from '@/query/queryEnvContext';

import { reposOf, withRepos } from './edits';
import { firstRunPath, type SavedStepProps } from './paths';
import { StepFrame } from './StepFrame';

export function ReposStep({
  dashboard: initial,
  onSave,
}: SavedStepProps): React.JSX.Element {
  // The step works from the dashboard it opened with, so finding repos
  // or branches runs once.
  const [dashboard] = useState(initial);
  const env = useQueryEnv();
  const navigate = useNavigate();
  const [error, run] = useActionError();
  const [repos, load] = useLoad<string[]>();
  const [chosen, setChosen] = useState<ReadonlySet<string>>(
    () => new Set(reposOf(dashboard)),
  );
  const id = dashboard.settings.githubToken;
  const token = id && env.providers.github(id) ? id : undefined;
  const listRepos = useCallback(() => {
    if (token) load(() => fetchRepoNames(env.client, token));
  }, [env.client, load, token]);
  useEffect(listRepos, [listRepos]);
  const toggle = (repo: string, on: boolean) => {
    setChosen((was) => {
      const next = new Set(was);
      if (on) next.add(repo);
      else next.delete(repo);
      return next;
    });
  };
  return (
    <StepFrame step={2} title="Pick your repos">
      {token ? (
        <p className="text-sm text-muted-foreground">
          Each repo you tick becomes a row on the board.
        </p>
      ) : (
        <p role="alert" className="text-sm text-status-failure">
          This tab no longer holds the dashboard&apos;s token (it was kept for a
          tab that has closed). Open the board and enter it again under
          Credentials.{' '}
          <Link to={`/d/${dashboard.id}`} className="underline">
            Open the board
          </Link>
        </p>
      )}
      <LoadStatus
        state={repos}
        loading="Loading your repos…"
        onRetry={listRepos}
      />
      {repos.kind === 'done' && (
        <div className="flex flex-col gap-2 text-left">
          <RepoList repos={repos.value} className="max-h-[50vh]">
            {(repo) => (
              <CheckField
                label={repo}
                className="px-2 py-1 text-sm"
                checked={chosen.has(repo)}
                onCheckedChange={(on) => {
                  toggle(repo, on);
                }}
              />
            )}
          </RepoList>
          {repos.value.length === 0 && (
            <p className="text-sm">
              This token can&apos;t see any repos.{' '}
              <ExternalLink href={readmeSection('github')}>
                Check its repository access
              </ExternalLink>
            </p>
          )}
        </div>
      )}
      <ActionError error={error} />
      <Button
        className="self-start"
        disabled={chosen.size === 0}
        onClick={() => {
          run(() => {
            onSave(
              withRepos(
                dashboard,
                chosen,
                repos.kind === 'done' ? repos.value : [...chosen],
              ),
            );
            navigate(firstRunPath(dashboard.id, 'stages'));
          });
        }}
      >
        Next: set up stages ({chosen.size})
      </Button>
    </StepFrame>
  );
}
