/**
 * One item of an editor list, on the library Collapsible (spec.md C-21):
 * a header that always shows (an optional lead such as a drag handle, a
 * chevron with the item's name and summary that opens and closes it, and
 * actions such as move and remove), and a body with the item's fields,
 * mounted only while open. Which item is open is the owner's (see
 * `useAccordion`); an item added while the list is shown scrolls into
 * view. `ItemHeaderPreview` is the same header, inert, for a drag
 * overlay.
 *
 * @module
 */
import { ChevronRight } from 'lucide-react';
import { useEffect, useRef } from 'react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

/** The chevron, name and summary of an item's header. */
function Heading({
  name,
  summary,
}: {
  name: string;
  summary?: React.ReactNode;
}): React.JSX.Element {
  return (
    <>
      <ChevronRight
        aria-hidden
        className="size-4 shrink-0 transition-transform"
      />
      <span className="truncate font-medium">{name}</span>
      {summary !== undefined && (
        <>
          {/* A space between, for the trigger's accessible name. */}{' '}
          <span className="truncate text-xs text-muted-foreground">
            {summary}
          </span>
        </>
      )}
    </>
  );
}

/** An item's collapsed header, inert (no trigger or actions): what a drag
 * carries under the cursor. */
export function ItemHeaderPreview({
  name,
  summary,
  lead,
}: {
  name: string;
  summary?: React.ReactNode;
  lead?: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-1 rounded-md border bg-background p-2 shadow-lg">
      {lead}
      <Heading name={name} summary={summary} />
    </div>
  );
}

/** Whether an item is open, and its owner's handlers (`useAccordion`). */
export interface ItemOpenState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Scroll into view when shown (a newly added item). */
  scrollIntoView?: boolean;
}

export function CollapsibleItem({
  name,
  summary,
  open,
  onOpenChange,
  lead,
  actions,
  children,
  target,
  label,
  scrollIntoView = false,
  className,
}: ItemOpenState & {
  /** The item's name, in the header. */
  name: string;
  /** What else identifies it at a glance (a repo, a pattern). */
  summary?: React.ReactNode;
  /** Before the name, e.g. the drag handle. */
  lead?: React.ReactNode;
  /** After the name, e.g. move and remove. */
  actions?: React.ReactNode;
  /** The item's fields. */
  children: React.ReactNode;
  /** Its editor-item key, for the editor to open and mark on a fix. */
  target?: string;
  /** An accessible name for the item as a region. */
  label?: string;
  className?: string;
}): React.JSX.Element {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    // Not every environment lays out (scrolling is a nicety there).
    const el = ref.current;
    if (scrollIntoView && typeof el?.scrollIntoView === 'function')
      el.scrollIntoView({ block: 'nearest' });
  }, [scrollIntoView]);
  return (
    <Collapsible asChild open={open} onOpenChange={onOpenChange}>
      <section
        ref={ref}
        aria-label={label}
        data-edit-target={target}
        className={cn('flex flex-col gap-2 rounded-md border p-2', className)}
      >
        <div className="flex items-center gap-1">
          {lead}
          <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-1 rounded-sm text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&[data-state=open]>svg]:rotate-90">
            <Heading name={name} summary={summary} />
          </CollapsibleTrigger>
          {actions !== undefined && (
            <div className="flex shrink-0 items-center gap-1">{actions}</div>
          )}
        </div>
        <CollapsibleContent>{children}</CollapsibleContent>
      </section>
    </Collapsible>
  );
}
