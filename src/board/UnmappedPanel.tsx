/**
 * Unmapped runs (spec.md C-15): recent runs the board could not place,
 * with why, a link to each run, and *Add test* to open the editor on the
 * fix, pre-filled.
 *
 * @module
 */
import { ExternalLink } from '@/components/ExternalLink';
import { Button } from '@/components/ui/button';
import { describeUnmappedReason } from '@/domain/derivation';
import type { UnmappedRun } from '@/engine';

export function UnmappedPanel({
  runs,
  onAddTest,
  onAddOverride,
}: {
  runs: readonly UnmappedRun[];
  /** Absent when there's no fix to pre-fill for this run. */
  onAddTest: (run: UnmappedRun) => (() => void) | undefined;
  /** For a branch no stage matches: a branch-pattern override instead of
   * a new stage (C-15). Absent when it can't help. */
  onAddOverride?: (run: UnmappedRun) => (() => void) | undefined;
}): React.JSX.Element {
  if (runs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Every recent run has a cell.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {runs.map((run) => {
        const add = onAddTest(run);
        const override = onAddOverride?.(run);
        return (
          <li
            key={`${run.repo}-${String(run.runId)}`}
            className="flex flex-col gap-1 rounded-md border p-2"
          >
            <div className="flex items-center gap-2">
              <ExternalLink href={run.htmlUrl} className="font-medium">
                {run.workflowName}
              </ExternalLink>
              <span className="text-xs text-muted-foreground">
                {run.repo}
                {run.branch ? ` · ${run.branch}` : ''}
              </span>
              {add && (
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={add}
                >
                  Add test
                </Button>
              )}
              {override && (
                <Button
                  size="sm"
                  variant="outline"
                  className={add ? undefined : 'ml-auto'}
                  onClick={override}
                >
                  Add override
                </Button>
              )}
            </div>
            <span className="text-xs">
              {describeUnmappedReason(run.reason)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
