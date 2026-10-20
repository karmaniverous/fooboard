/**
 * The board's runs no status matches (spec.md A§4.3.6): each Unknown cell
 * with its set and the document its tests saw, and *Add status*. Each collapses to its header (row, stage,
 * set, *Add status*), one open at a time; the document shows when open.
 *
 * @module
 */
import { CollapsibleItem } from '@/components/CollapsibleItem';
import { Button } from '@/components/ui/button';

import { useAccordion } from '../useAccordion';
import type { UnknownCell } from './unknownRuns';

/** A run's cell, which identifies it in the list. */
const keyOf = (c: UnknownCell) => `${c.rowId}/${c.stageId}`;

export function UnknownRunsList({
  unknown,
  onAddStatus,
}: {
  unknown: readonly UnknownCell[];
  onAddStatus: (cell: UnknownCell) => void;
}): React.JSX.Element | null {
  const accordion = useAccordion(
    unknown.map((c) => ({ key: keyOf(c), targets: [] })),
  );
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
        <CollapsibleItem
          key={keyOf(c)}
          {...accordion.itemProps(keyOf(c))}
          name={`${c.rowName} · ${c.stageName}`}
          summary={c.setName}
          className="gap-1 p-1"
          actions={
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
          }
        >
          <pre className="max-h-32 overflow-auto rounded bg-muted p-1 text-[0.7rem]">
            {JSON.stringify(c.document, null, 2)}
          </pre>
        </CollapsibleItem>
      ))}
    </section>
  );
}
