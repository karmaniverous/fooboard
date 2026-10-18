/**
 * The board's runs no status matches (spec.md A§4.3.6): each Unknown cell
 * with its set and the document its tests saw, and *Add status*.
 *
 * @module
 */
import { Button } from '@/components/ui/button';

import type { UnknownCell } from './unknownRuns';

export function UnknownRunsList({
  unknown,
  onAddStatus,
}: {
  unknown: readonly UnknownCell[];
  onAddStatus: (cell: UnknownCell) => void;
}): React.JSX.Element | null {
  if (unknown.length === 0) return null;
  return (
    <section
      aria-label="Runs no status matches"
      className="flex flex-col gap-2 rounded border border-dashed p-2"
    >
      <h4 className="text-xs font-semibold">
        Runs no status matches ({unknown.length})
      </h4>
      {unknown.map((c) => (
        <div key={`${c.rowId}/${c.stageId}`} className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span>
              {c.rowName} &middot; {c.stageName} ({c.setName})
            </span>
            <Button
              size="sm"
              variant="outline"
              aria-label={`Add status for ${c.rowName} ${c.stageName}`}
              onClick={() => {
                onAddStatus(c);
              }}
            >
              Add status
            </Button>
          </div>
          <pre className="max-h-32 overflow-auto rounded bg-muted p-1 text-[0.7rem]">
            {JSON.stringify(c.document, null, 2)}
          </pre>
        </div>
      ))}
    </section>
  );
}
