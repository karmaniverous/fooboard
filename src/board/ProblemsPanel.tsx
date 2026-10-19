/**
 * Problems (spec.md A§4.3.7): every problem the board has, where it is,
 * with *Fix* to open the editor there and *Dismiss* for the ones that are
 * only hints.
 *
 * @module
 */
import { Button } from '@/components/ui/button';
import type { Dashboard } from '@/domain/config/dashboard';
import type { Problem } from '@/domain/problems/problems';

import { levelLabel } from './levelLabel';

export function ProblemsPanel({
  dashboard,
  problems,
  onFix,
  onDismiss,
}: {
  dashboard: Dashboard;
  problems: readonly Problem[];
  onFix: (problem: Problem) => void;
  onDismiss: (id: string) => void;
}): React.JSX.Element {
  if (problems.length === 0)
    return <p className="text-sm text-muted-foreground">No problems.</p>;
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {problems.map((p) => (
        <li key={p.id} className="flex flex-col gap-1 rounded-md border p-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {levelLabel(dashboard, p.level)}
            </span>
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
        </li>
      ))}
    </ul>
  );
}
