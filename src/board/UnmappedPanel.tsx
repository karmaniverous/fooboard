/**
 * Unmapped records (spec.md C-15, §2.5; spec 0.2.0 §3.I): recent GitHub
 * runs and Amplify jobs the board could not place, with why (per row,
 * when several read its repo or app), a link to each, *Add rule* to open
 * the editor on the fix, and *Dismiss…* to hide entries like it with a
 * pattern saved to the dashboard (validated like every edit; *Not saved*
 * when refused). The heading counts the entries shown and those
 * dismissed; *Show dismissed* (a toggle, for this visit) lists the
 * dismissed ones greyed, each naming its pattern, with *Undo* (focus
 * goes to the restored entry). A
 * dismissal only hides entries: the board reads and places runs as
 * before.
 *
 * @module
 */
import { Check } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import { ExternalLink } from '@/components/ExternalLink';
import { Button } from '@/components/ui/button';
import type { Dashboard } from '@/domain/config/dashboard';
import {
  describeDismissal,
  type UnmappedDismissal,
} from '@/domain/config/unmappedDismissals';
import { NotSaved } from '@/editors/NotSaved';
import { useValidatedChange } from '@/editors/useValidatedChange';
import type { UnmappedRun } from '@/engine';
import {
  type DismissalPattern,
  type DismissedRun,
  splitUnmapped,
} from '@/engine/unmappedDismissals';

import { BOARD_TITLE_ID } from './BoardScreen';
import { DismissForm } from './DismissForm';
import {
  hiddenBy,
  SHOW_DISMISSED,
  UNDO,
  unmappedHeading,
  whereText,
} from './dismissWords';
import { UnmappedEntry } from './UnmappedEntry';

/** The dismissed entries, greyed, each with the pattern hiding it. */
function DismissedList({
  dismissed,
  onUndo,
}: {
  dismissed: readonly DismissedRun[];
  onUndo: (dismissed: DismissedRun) => void;
}): React.JSX.Element {
  return (
    <ul
      aria-label="Dismissed runs"
      className="flex flex-col gap-2 text-sm text-muted-foreground"
    >
      {dismissed.map(({ run, by }) => (
        <li
          key={run.id}
          className="flex flex-wrap items-center gap-2 rounded-md border border-dashed p-2"
        >
          <ExternalLink href={run.htmlUrl}>{run.title}</ExternalLink>
          <span className="text-xs">{whereText(run)}</span>
          <span className="w-full text-xs">
            {hiddenBy(describeDismissal(by))}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            onClick={() => {
              onUndo({ run, by });
            }}
          >
            {UNDO}
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function UnmappedPanel({
  unmapped,
  dashboard,
  onChange,
  showDismissed,
  onShowDismissed,
  onAddTest,
  onAddOverride,
  rowNames,
}: {
  /** Every unmapped entry the board found, dismissed or not. */
  unmapped: readonly UnmappedRun[];
  dashboard: Dashboard;
  /** Save an edited dashboard (a dismissal added or removed). */
  onChange: (dashboard: Dashboard) => void;
  /** Whether the dismissed entries are listed (this visit only). */
  showDismissed: boolean;
  onShowDismissed: (show: boolean) => void;
  /** Row display names by id, for per-row reasons. */
  rowNames?: Readonly<Record<string, string>>;
  /** Absent when there's no fix to pre-fill for this run. */
  onAddTest: (run: UnmappedRun) => (() => void) | undefined;
  /** For a branch no stage matches: a branch-pattern override instead of
   * a new stage (C-15). Absent when it can't help. */
  onAddOverride?: (run: UnmappedRun) => (() => void) | undefined;
}): React.JSX.Element {
  const { shown, dismissed } = splitUnmapped(
    unmapped,
    dashboard.unmappedDismissals,
  );
  const { update, error } = useValidatedChange(onChange);
  const [formFor, setFormFor] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  /** The entry *Undo* restored: its *Dismiss…* button takes focus as it
   * mounts. */
  const restored = useRef<string | null>(null);
  const base = useId();

  const withDismissals = (list: UnmappedDismissal[]): Dashboard => ({
    ...dashboard,
    unmappedDismissals: list,
  });
  const dismiss = (pattern: DismissalPattern) => {
    const next = withDismissals([
      ...dashboard.unmappedDismissals,
      { id: crypto.randomUUID(), ...pattern },
    ]);
    if (!update(next)) return;
    setFormFor(null);
    if (splitUnmapped(unmapped, next.unmappedDismissals).shown.length > 0)
      heading.current?.focus();
    // The last entry gone, the panel and its button go too: focus the
    // board's title once the panel has let go of it.
    else
      setTimeout(() => {
        document.getElementById(BOARD_TITLE_ID)?.focus();
      }, 0);
  };
  const cancel = (runId: string) => {
    setFormFor(null);
    buttons.current.get(runId)?.focus();
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3
          ref={heading}
          tabIndex={-1}
          className="text-sm font-medium outline-none"
        >
          {unmappedHeading(shown.length, dismissed.length)}
        </h3>
        {dismissed.length > 0 && (
          <Button
            size="sm"
            // Pressed: filled, with a check (WCAG 1.4.11: the fill is
            // well over 3:1 on the panel, and unlike the ghost hover).
            variant={showDismissed ? 'default' : 'ghost'}
            className="ml-auto gap-1"
            aria-pressed={showDismissed}
            onClick={() => {
              onShowDismissed(!showDismissed);
            }}
          >
            {showDismissed && <Check aria-hidden className="size-4" />}
            {SHOW_DISMISSED}
          </Button>
        )}
      </div>
      {formFor === null && <NotSaved error={error} />}
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Every recent run has a cell.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {shown.map((run) => {
            const formId = `${base}-${run.id}`;
            const open = formFor === run.id;
            return (
              <UnmappedEntry
                key={run.id}
                run={run}
                rowNames={rowNames}
                add={onAddTest(run)}
                override={onAddOverride?.(run)}
                formId={formId}
                formOpen={open}
                onToggleForm={() => {
                  setFormFor(open ? null : run.id);
                }}
                dismissButton={(button) => {
                  if (!button) {
                    buttons.current.delete(run.id);
                    return;
                  }
                  buttons.current.set(run.id, button);
                  if (restored.current !== run.id) return;
                  restored.current = null;
                  button.focus();
                }}
              >
                {open && (
                  <DismissForm
                    id={formId}
                    run={run}
                    entries={shown}
                    onDismiss={dismiss}
                    onCancel={() => {
                      cancel(run.id);
                    }}
                  >
                    <NotSaved error={error} />
                  </DismissForm>
                )}
              </UnmappedEntry>
            );
          })}
        </ul>
      )}
      {showDismissed && dismissed.length > 0 && (
        <DismissedList
          dismissed={dismissed}
          onUndo={({ run, by }) => {
            const next = withDismissals(
              dashboard.unmappedDismissals.filter((d) => d.id !== by.id),
            );
            if (update(next)) restored.current = run.id;
          }}
        />
      )}
    </div>
  );
}
