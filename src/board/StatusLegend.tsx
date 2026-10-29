/**
 * The board's legend (spec.md A§4.3.6): each status set its cells use,
 * with its statuses as cells show them, then Unknown. Opened by an icon
 * button named, and tooltipped, *Legend* (spec 0.2.0 §3.A), whose focus
 * returns without the tooltip after a touch (`useTouchFocusReturn`).
 *
 * @module
 */
import { Info } from 'lucide-react';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { WithTooltip } from '@/components/ui/tooltip';
import { useTouchFocusReturn } from '@/components/useTouchFocusReturn';
import type { Dashboard } from '@/domain/config/dashboard';
import {
  type ResolvedStatus,
  resolveStatus,
  UNKNOWN,
} from '@/domain/statuses/resolved';
import { cn } from '@/lib/utils';

import { BoardActionButton } from './BoardActionButton';
import { STATUS_GLYPH, statusLook } from './cellView';
import { legendSets } from './legendSets';

/** The legend's name: its button's, its tooltip's and its popover's. */
const LEGEND = 'Legend';

function Swatch({ status }: { status: ResolvedStatus }): React.JSX.Element {
  const look = statusLook(status);
  return (
    <li
      className={cn(
        'flex items-center gap-1.5 rounded px-1.5 py-0.5',
        look.className,
      )}
      style={look.style}
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
  const { triggerProps, onCloseAutoFocus } = useTouchFocusReturn();
  return (
    <Popover>
      <WithTooltip label={LEGEND}>
        <PopoverTrigger asChild {...triggerProps}>
          <BoardActionButton label={LEGEND} Icon={Info} />
        </PopoverTrigger>
      </WithTooltip>
      <PopoverContent
        aria-label={LEGEND}
        onCloseAutoFocus={onCloseAutoFocus}
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
