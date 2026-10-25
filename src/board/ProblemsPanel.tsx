/**
 * Problems (spec.md A§4.3.7): every problem the board has, where it is,
 * with *Fix* to open the editor at the item, *Customise* for a problem in
 * a built-in rule, its one-click actions (*Pin*, *Unpin*, spec.md §3.12),
 * and *Dismiss* for the ones that are only hints. Notes (what the
 * consistency check can't decide, rules for a source no row uses) follow,
 * dismissable.
 *
 * @module
 */
import { Button } from '@/components/ui/button';
import type { Dashboard } from '@/domain/config/dashboard';
import type { Problem } from '@/domain/problems/problem';
import { changePins } from '@/domain/settings/pins';

import { levelLabel } from './levelLabel';

function ProblemItem({
  dashboard,
  problem: p,
  onFix,
  onCustomise,
  onDismiss,
  onChange,
}: {
  dashboard: Dashboard;
  problem: Problem;
  onFix: (problem: Problem) => void;
  onCustomise: ((problem: Problem) => void) | undefined;
  onDismiss: (id: string) => void;
  onChange: ((dashboard: Dashboard) => void) | undefined;
}): React.JSX.Element {
  return (
    <li className="flex flex-col gap-1 rounded-md border p-2">
      <div className="flex items-center gap-2">
        <span className="font-medium">{levelLabel(dashboard, p.level)}</span>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => {
            onFix(p);
          }}
        >
          Fix
        </Button>
        {onCustomise && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              onCustomise(p);
            }}
          >
            Customise
          </Button>
        )}
        {p.dismissable && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              onDismiss(p.id);
            }}
          >
            Dismiss
          </Button>
        )}
      </div>
      <span className="text-xs">{p.message}</span>
      {onChange && p.actions && (
        <div className="flex flex-wrap gap-1">
          {p.actions.map((action) => (
            <Button
              key={`${action.kind}:${action.pin.region}:${action.pin.appId}:${action.pin.credentialId ?? ''}`}
              size="sm"
              variant="outline"
              onClick={() => {
                onChange(changePins(dashboard, action));
              }}
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </li>
  );
}

export function ProblemsPanel({
  dashboard,
  problems,
  onFix,
  onDismiss,
  onCustomise,
  canCustomise = () => false,
  onChange,
}: {
  dashboard: Dashboard;
  problems: readonly Problem[];
  onFix: (problem: Problem) => void;
  onDismiss: (id: string) => void;
  /** Customise the built-in rule a problem is in. */
  onCustomise?: (problem: Problem) => void;
  canCustomise?: (problem: Problem) => boolean;
  /** Save the dashboard a problem's one-click action (*Pin*, *Unpin*)
   * changed. */
  onChange?: (dashboard: Dashboard) => void;
}): React.JSX.Element {
  if (problems.length === 0)
    return <p className="text-sm text-muted-foreground">No problems.</p>;
  const item = (p: Problem) => (
    <ProblemItem
      key={p.id}
      dashboard={dashboard}
      problem={p}
      onFix={onFix}
      onCustomise={canCustomise(p) ? onCustomise : undefined}
      onDismiss={onDismiss}
      onChange={onChange}
    />
  );
  const notes = problems.filter((p) => p.severity === 'note');
  return (
    <div className="flex flex-col gap-3 text-sm">
      <ul className="flex flex-col gap-2">
        {problems.filter((p) => p.severity === 'problem').map(item)}
      </ul>
      {notes.length > 0 && (
        <section aria-label="Notes" className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground">Notes</h3>
          <ul className="flex flex-col gap-2">{notes.map(item)}</ul>
        </section>
      )}
    </div>
  );
}
