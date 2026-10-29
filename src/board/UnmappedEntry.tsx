/**
 * One entry of the *Unmapped runs* panel (spec.md C-15, §2.5; spec 0.2.0
 * §3.I): the run or job linked, where it was read and its branch, why no
 * cell takes it (per row, when several read its repo or app), and its
 * fixes: *Add rule*, *Add override* and *Dismiss…*, whose form opens
 * inside the entry, below its reasons (`children`).
 *
 * @module
 */
import { ExternalLink } from '@/components/ExternalLink';
import { Button } from '@/components/ui/button';
import { describeUnmappedReason } from '@/domain/derivation';
import type { UnmappedRun } from '@/engine';

import { DISMISS_OPEN, whereText } from './dismissWords';

export function UnmappedEntry({
  run,
  rowNames,
  add,
  override,
  formId,
  formOpen,
  onToggleForm,
  dismissButton,
  children,
}: {
  run: UnmappedRun;
  /** Row display names by id, for per-row reasons. */
  rowNames?: Readonly<Record<string, string>>;
  /** *Add rule*, when there is a fix to pre-fill. */
  add?: () => void;
  /** *Add override*, when it can help. */
  override?: () => void;
  /** The id of the entry's *Dismiss…* form. */
  formId: string;
  formOpen: boolean;
  onToggleForm: () => void;
  /** Receives the *Dismiss…* button, so focus can return to it. */
  dismissButton: (button: HTMLButtonElement | null) => void;
  /** The open form. */
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <li className="flex flex-col gap-1 rounded-md border p-2">
      <div className="flex flex-wrap items-center gap-2">
        <ExternalLink href={run.htmlUrl} className="font-medium">
          {run.title}
        </ExternalLink>
        <span className="text-xs text-muted-foreground">{whereText(run)}</span>
        <span className="ml-auto flex gap-2">
          {add && (
            <Button size="sm" variant="outline" onClick={add}>
              Add rule
            </Button>
          )}
          {override && (
            <Button size="sm" variant="outline" onClick={override}>
              Add override
            </Button>
          )}
          <Button
            ref={dismissButton}
            size="sm"
            variant="outline"
            aria-expanded={formOpen}
            aria-controls={formOpen ? formId : undefined}
            onClick={onToggleForm}
          >
            {DISMISS_OPEN}
          </Button>
        </span>
      </div>
      {run.rows.length > 1 ? (
        <ul className="text-xs">
          {run.rows.map(({ rowId, reason }) => (
            <li key={rowId}>
              {rowNames?.[rowId] ?? rowId}: {describeUnmappedReason(reason)}
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-xs">{describeUnmappedReason(run.reason)}</span>
      )}
      {children}
    </li>
  );
}
