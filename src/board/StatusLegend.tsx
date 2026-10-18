/**
 * The board's legend (spec.md A§4.3.6): each status set its cells use,
 * with its statuses as cells show them, then Unknown.
 *
 * @module
 */
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { Dashboard } from '@/domain/config/dashboard';
import {
  type ResolvedStatus,
  resolveStatus,
  UNKNOWN,
} from '@/domain/statuses/resolved';
import { textOn } from '@/lib/contrast';
import { cn } from '@/lib/utils';

import { STATUS_GLYPH } from './cellView';
import { legendSets } from './legendSets';

function Swatch({ status }: { status: ResolvedStatus }): React.JSX.Element {
  return (
    <li
      className={cn(
        'flex items-center gap-1.5 rounded px-1.5 py-0.5',
        status.outlined && 'border border-dashed border-slate-500',
      )}
      style={{ backgroundColor: status.color, color: textOn(status.color) }}
    >
      <span aria-hidden className="w-[1em] text-center">
        {STATUS_GLYPH[status.icon]}
      </span>
      {status.name}
      <span className="ml-auto opacity-80">{status.summary.name}</span>
    </li>
  );
}

export function StatusLegend({
  dashboard,
}: {
  dashboard: Dashboard;
}): React.JSX.Element {
  const sets = legendSets(dashboard);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          Legend
        </Button>
      </PopoverTrigger>
      <PopoverContent
        aria-label="Legend"
        className="flex max-h-[70vh] w-72 flex-col gap-3 overflow-auto text-xs"
      >
        {sets.map((set) => (
          <section
            key={set.id}
            aria-label={set.name}
            className="flex flex-col gap-1"
          >
            <h3 className="font-semibold">{set.name}</h3>
            <ul className="flex flex-col gap-0.5">
              {set.cell.map((c) => (
                <Swatch key={c.id} status={resolveStatus(set, c)} />
              ))}
            </ul>
          </section>
        ))}
        <ul aria-label="No match">
          <Swatch status={UNKNOWN} />
        </ul>
        <p className="text-muted-foreground">
          A cell shows the first status its run matches; Unknown when it matches
          none.
        </p>
      </PopoverContent>
    </Popover>
  );
}
