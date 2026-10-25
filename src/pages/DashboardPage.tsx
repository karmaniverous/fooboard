/**
 * A saved dashboard (spec.md §2.4): the live board read with this
 * dashboard's credentials through the app's query environment, plus its
 * credentials panel. The board waits for the persisted cache to be
 * restored, then shows it at once (§3.4). A changed secret removes what
 * was read with the old one (`appQueryEnv`) and re-derives the board, so
 * entering a token fills it at once.
 *
 * @module
 */
import { use, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { BoardScreen } from '@/board/BoardScreen';
import { ProblemsPanel } from '@/board/ProblemsPanel';
import { UnmappedPanel } from '@/board/UnmappedPanel';
import { SidePanel } from '@/components/SidePanel';
import { Button } from '@/components/ui/button';
import { CredentialsPanel } from '@/credentials/CredentialsPanel';
import { useCredentialVersion } from '@/credentials/useCredentialVersion';
import type { Dashboard } from '@/domain/config/dashboard';
import type { Problem } from '@/domain/problems/problem';
import { customiseFor, offersCustomise } from '@/editors/customiseFix';
import { DashboardEditor } from '@/editors/DashboardEditor';
import {
  draftFor,
  type EditorDraft,
  overrideDraftFor,
  problemDraft,
} from '@/editors/draft';
import { ruleSamples } from '@/editors/rules/samples';
import { unknownCells } from '@/editors/statuses/unknownRuns';
import { appQueryEnv } from '@/engine/appEnv';
import { QueryProvider } from '@/query/QueryProvider';
import { dashboardsOf } from '@/storage/configStore';
import { useStores } from '@/storage/storesContext';

/** The Problems button: problems counted, or the notes when only notes. */
function problemsLabel(shown: readonly Problem[]): string {
  const problems = shown.filter((p) => p.severity === 'problem').length;
  return problems > 0 || shown.length === 0
    ? `Problems (${String(problems)})`
    : `Notes (${String(shown.length)})`;
}

function SavedDashboard({
  initial,
  others,
}: {
  initial: Dashboard;
  others: readonly Dashboard[];
}): React.JSX.Element {
  const stores = useStores();
  const { config } = stores;
  const env = appQueryEnv(stores);
  const [dashboard, setDashboard] = useState(initial);
  // A changed secret (new `version`) has dropped what the old one read;
  // the board re-derives (`refreshKey`).
  const version = useCredentialVersion();
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
      refreshKey={version}
      onOpenProblem={(p) => {
        openEditor(problemDraft(p));
      }}
      actions={(model, problems) => (
        <>
          {problems.shown.length > 0 && (
            <SidePanel
              title="Problems"
              trigger={
                <Button size="sm" variant="outline">
                  {problemsLabel(problems.shown)}
                </Button>
              }
            >
              <ProblemsPanel
                dashboard={dashboard}
                problems={problems.shown}
                onFix={(p) => {
                  openEditor(problemDraft(p));
                }}
                onCustomise={(p) => {
                  const fix = customiseFor(dashboard, p);
                  if (!fix) return;
                  save(fix.dashboard);
                  openEditor(fix.draft);
                }}
                canCustomise={(p) => offersCustomise(dashboard, p)}
                onDismiss={problems.dismiss}
                onChange={save}
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
                rowNames={Object.fromEntries(
                  dashboard.rows.map((r) => [r.id, r.displayName]),
                )}
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
              onChange={save}
              unknown={unknownCells(dashboard, model)}
              samples={ruleSamples(dashboard.rows, model.cells)}
              branchSamples={model.amplifyBranches}
              problems={problems.shown}
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
              tokenExpiry={(id) =>
                env.providers.github(id)?.getTokenExpiration()
              }
              keyApps={(id) => model.amplifyKeyApps[id]}
            />
          </SidePanel>
        </>
      )}
    />
  );
}

export function DashboardPage(): React.JSX.Element {
  const { id } = useParams();
  const stores = useStores();
  const loaded = stores.config.load();
  const dashboards = dashboardsOf(loaded);
  const dashboard = dashboards.find((d) => d.id === id);
  const env = appQueryEnv(stores);
  // The cached board shows once restored (the app's Suspense waits).
  if (!env.isRestored()) use(env.restored);
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
    <QueryProvider env={env}>
      <SavedDashboard
        key={dashboard.id}
        initial={dashboard}
        others={dashboards.filter((d) => d.id !== dashboard.id)}
      />
    </QueryProvider>
  );
}
