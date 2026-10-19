/**
 * A saved dashboard (spec.md §4.4): the live board read with this
 * dashboard's credentials, plus its credentials panel. Readers are
 * rebuilt whenever a secret changes, so entering a token fills the board
 * at once instead of on the next poll.
 *
 * @module
 */
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { BoardScreen } from '@/board/BoardScreen';
import { ProblemsPanel } from '@/board/ProblemsPanel';
import { UnmappedPanel } from '@/board/UnmappedPanel';
import { SidePanel } from '@/components/SidePanel';
import { Button } from '@/components/ui/button';
import { CredentialsPanel } from '@/credentials/CredentialsPanel';
import { useCredentialVersion } from '@/credentials/useCredentialVersion';
import type { Dashboard } from '@/domain/config/dashboard';
import { DashboardEditor } from '@/editors/DashboardEditor';
import {
  draftFor,
  type EditorDraft,
  overrideDraftFor,
  problemDraft,
} from '@/editors/draft';
import { unknownCells } from '@/editors/statuses/unknownRuns';
import { credentialProviders } from '@/engine/credentialProviders';
import { dashboardsOf } from '@/storage/configStore';
import { useStores } from '@/storage/storesContext';

function SavedDashboard({
  initial,
  others,
}: {
  initial: Dashboard;
  others: readonly Dashboard[];
}): React.JSX.Element {
  const { config, credentials } = useStores();
  const [dashboard, setDashboard] = useState(initial);
  const version = useCredentialVersion();
  // A changed secret (new `version`) rebuilds the providers, which
  // restarts the engine with the new readers.
  const providers = useMemo(
    () => ({ ...credentialProviders(credentials), version }),
    [credentials, version],
  );
  const save = (next: Dashboard) => {
    config.saveDashboard(next);
    setDashboard(next);
  };
  const missing = dashboard.credentials.length === 0;
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<{ n: number; draft?: EditorDraft }>({
    n: 0,
  });
  const openEditor = (next?: EditorDraft) => {
    setDraft((d) => ({ n: d.n + 1, draft: next }));
    setEditorOpen(true);
  };
  /** A fix button's action: open the editor on `next`, if there is one. */
  const fixWith = (next: EditorDraft | undefined) =>
    next
      ? () => {
          openEditor(next);
        }
      : undefined;
  return (
    <BoardScreen
      dashboard={dashboard}
      providers={providers}
      actions={(model, problems) => (
        <>
          {problems.shown.length > 0 && (
            <SidePanel
              title="Problems"
              trigger={
                <Button size="sm" variant="outline">
                  Problems ({problems.shown.length})
                </Button>
              }
            >
              <ProblemsPanel
                dashboard={dashboard}
                problems={problems.shown}
                onFix={(p) => {
                  openEditor(problemDraft(p));
                }}
                onDismiss={problems.dismiss}
              />
            </SidePanel>
          )}
          {model.unmapped.length > 0 && (
            <SidePanel
              title="Unmapped runs"
              trigger={
                <Button size="sm" variant="outline">
                  Unmapped ({model.unmapped.length})
                </Button>
              }
            >
              <UnmappedPanel
                runs={model.unmapped}
                onAddTest={(run) => fixWith(draftFor(run, dashboard))}
                onAddOverride={(run) =>
                  fixWith(overrideDraftFor(run, dashboard))
                }
              />
            </SidePanel>
          )}
          <SidePanel
            open={editorOpen}
            onOpenChange={(open) => {
              if (open) openEditor();
              else setEditorOpen(false);
            }}
            title="Edit dashboard"
            trigger={
              <Button size="sm" variant="outline">
                Edit
              </Button>
            }
          >
            <DashboardEditor
              key={draft.n}
              draft={draft.draft}
              dashboard={dashboard}
              providers={providers}
              onChange={save}
              unknown={unknownCells(dashboard, model)}
            />
          </SidePanel>
          <SidePanel
            title="Credentials"
            trigger={
              <Button size="sm" variant={missing ? 'default' : 'outline'}>
                {missing ? 'Add a credential' : 'Credentials'}
              </Button>
            }
          >
            <CredentialsPanel
              dashboard={dashboard}
              otherDashboards={others}
              onChange={save}
              tokenExpiry={(id) => providers.github(id)?.getTokenExpiration()}
            />
          </SidePanel>
        </>
      )}
    />
  );
}

export function DashboardPage(): React.JSX.Element {
  const { id } = useParams();
  const loaded = useStores().config.load();
  const dashboards = dashboardsOf(loaded);
  const dashboard = dashboards.find((d) => d.id === id);
  if (!dashboard) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-6 py-24 text-center">
        <h1 className="text-xl font-semibold">Dashboard not found</h1>
        <p className="text-sm text-muted-foreground">
          It isn&apos;t saved in this browser.
        </p>
        <Link to="/" className="underline underline-offset-2">
          Back to your dashboards
        </Link>
      </div>
    );
  }
  return (
    <SavedDashboard
      key={dashboard.id}
      initial={dashboard}
      others={dashboards.filter((d) => d.id !== dashboard.id)}
    />
  );
}
