/**
 * A dashboard's board with its panels (spec.md §2.4): the live board read
 * through the query env its page provides, its Problems and Unmapped
 * panels, the dashboard editor and the credentials panel, each opened by
 * an icon button beside the board's name (spec 0.2.0 §3.A), every edit
 * handed to `onSave`. A saved dashboard saves it to this browser; the
 * demo keeps it in memory for the tab (§3.14). A changed secret removes
 * what was read with the old one and re-derives the board, so entering a
 * token fills it at once.
 *
 * @module
 */
import {
  KeyRound,
  type LucideIcon,
  MessageSquareText,
  Pencil,
  TriangleAlert,
  Unlink,
} from 'lucide-react';
import { useState } from 'react';

import {
  EDIT_DASHBOARD,
  UNMAPPED_RUNS,
  unmappedLabel,
} from '@/board/actionLabels';
import { BoardActionButton } from '@/board/BoardActionButton';
import { BOARD_TITLE_ID, BoardScreen } from '@/board/BoardScreen';
import { ProblemsPanel } from '@/board/ProblemsPanel';
import { UnmappedPanel } from '@/board/UnmappedPanel';
import { SidePanel } from '@/components/SidePanel';
import type { ButtonVariant } from '@/components/ui/buttonVariants';
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
import { FirstRunNote } from '@/firstRun/FirstRunNote';

/** How many of `shown` are problems rather than notes. */
const problemCount = (shown: readonly Problem[]): number =>
  shown.filter((p) => p.severity === 'problem').length;

/** The Problems panel and its button: problems counted, on a destructive
 * warning; or, when there are only notes, Notes with the notes counted. */
function problemsAction(shown: readonly Problem[]): {
  title: string;
  label: string;
  Icon: LucideIcon;
  variant: ButtonVariant;
} {
  const problems = problemCount(shown);
  return problems > 0 || shown.length === 0
    ? {
        title: 'Problems',
        label: `Problems (${String(problems)})`,
        Icon: TriangleAlert,
        variant: 'destructive',
      }
    : {
        title: 'Notes',
        label: `Notes (${String(shown.length)})`,
        Icon: MessageSquareText,
        variant: 'outline',
      };
}

/** The Credentials panel's title and button. */
const CREDENTIALS = 'Credentials';

/** The Credentials button with no credential yet. */
const ADD_A_CREDENTIAL = 'Add a credential';

export function DashboardView({
  initial,
  others,
  firstRun = false,
  onFirstRunDone,
  onSave,
}: {
  initial: Dashboard;
  /** The browser's other dashboards (the credentials panel copies). */
  others: readonly Dashboard[];
  /** Opened at the end of the first run: the board is its last step. */
  firstRun?: boolean;
  /** The first run's note closed (the page forgets it was opened so). */
  onFirstRunDone?: () => void;
  /** Keep an edited dashboard (saved, or in memory for the demo). */
  onSave: (dashboard: Dashboard) => void;
}): React.JSX.Element {
  const [dashboard, setDashboard] = useState(initial);
  const [intro, setIntro] = useState(firstRun);
  const closeIntro = () => {
    setIntro(false);
    onFirstRunDone?.();
    document.getElementById(BOARD_TITLE_ID)?.focus();
  };
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
      intro={
        intro
          ? (model, problems) => (
              <FirstRunNote
                unmapped={model.unmapped.length}
                problems={problemCount(problems.shown)}
                onDone={closeIntro}
              />
            )
          : undefined
      }
      actions={(model, problems) => {
        const problemsButton = problemsAction(problems.shown);
        return (
          <>
            {problems.shown.length > 0 && (
              <SidePanel
                title={problemsButton.title}
                tooltip={problemsButton.label}
                trigger={
                  <BoardActionButton
                    label={problemsButton.label}
                    Icon={problemsButton.Icon}
                    variant={problemsButton.variant}
                  />
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
                title={UNMAPPED_RUNS}
                tooltip={unmappedLabel(model.unmapped.length)}
                trigger={
                  <BoardActionButton
                    label={unmappedLabel(model.unmapped.length)}
                    Icon={Unlink}
                  />
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
              title={EDIT_DASHBOARD}
              tooltip={EDIT_DASHBOARD}
              trigger={
                <BoardActionButton label={EDIT_DASHBOARD} Icon={Pencil} />
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
              title={CREDENTIALS}
              tooltip={missing ? ADD_A_CREDENTIAL : CREDENTIALS}
              trigger={
                <BoardActionButton
                  label={missing ? ADD_A_CREDENTIAL : CREDENTIALS}
                  Icon={KeyRound}
                  variant={missing ? 'default' : 'outline'}
                />
              }
            >
              <CredentialsPanel
                dashboard={dashboard}
                otherDashboards={others}
                onChange={save}
                keyApps={(id) => model.amplifyKeyApps[id]}
              />
            </SidePanel>
          </>
        );
      }}
    />
  );
}
