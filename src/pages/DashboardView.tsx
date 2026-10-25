/**
 * A dashboard's board with its panels (spec.md §2.4): the live board read
 * through `env`, its Problems and Unmapped panels, the dashboard editor
 * and the credentials panel, every edit handed to `onSave`. A saved
 * dashboard saves it to this browser; the demo keeps it in memory for the
 * tab (§3.14). A changed secret removes what was read with the old one
 * and re-derives the board, so entering a token fills it at once.
 *
 * @module
 */
import { useState } from 'react';

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
  placeDraft,
  problemDraft,
} from '@/editors/draft';
import { ruleSamples } from '@/editors/rules/samples';
import { unknownCells } from '@/editors/statuses/unknownRuns';
import type { QueryEnv } from '@/query/client';

/** The Problems button: problems counted, or the notes when only notes. */
function problemsLabel(shown: readonly Problem[]): string {
  const problems = shown.filter((p) => p.severity === 'problem').length;
  return problems > 0 || shown.length === 0
    ? `Problems (${String(problems)})`
    : `Notes (${String(shown.length)})`;
}

export function DashboardView({
  initial,
  others,
  env,
  onSave,
}: {
  initial: Dashboard;
  /** The browser's other dashboards (the credentials panel copies). */
  others: readonly Dashboard[];
  env: QueryEnv;
  /** Keep an edited dashboard (saved, or in memory for the demo). */
  onSave: (dashboard: Dashboard) => void;
}): React.JSX.Element {
  const [dashboard, setDashboard] = useState(initial);
  // A changed secret (new `version`) has dropped what the old one read;
  // the board re-derives (`refreshKey`).
  const version = useCredentialVersion();
  const save = (next: Dashboard) => {
    onSave(next);
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
      onChange={save}
      onOpenSettings={(place) => {
        openEditor(placeDraft(place));
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
