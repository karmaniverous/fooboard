/**
 * A collapsed section of an editor: a chevron and a title, counting what
 * is set inside so a closed section still says whether it matters.
 * Opened by the editor whenever it is opened on something inside
 * (`target`), also while already shown; otherwise opened and closed by
 * hand.
 *
 * @module
 */
import { ChevronRight } from 'lucide-react';
import { useContext, useState } from 'react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { EditFocusContext, useFocused } from '@/editors/editTarget';
import { cn } from '@/lib/utils';

export function Disclosure({
  title,
  count,
  contentClassName,
  children,
  target,
  className,
  defaultOpen = false,
}: {
  title: string;
  /** How many settings inside are set; shown when any. */
  count: number;
  contentClassName: string;
  children: React.ReactNode;
  /** Its editor-item key: open when the editor focuses inside it. */
  target?: string;
  /** Classes for the whole section (its place in a layout). */
  className?: string;
  /** Open from the start, focused or not. */
  defaultOpen?: boolean;
}): React.JSX.Element {
  const { focus } = useContext(EditFocusContext);
  const focused = useFocused(target);
  const [state, setState] = useState(() => ({
    open: defaultOpen || focused,
    focus,
  }));
  // A new focus inside opens it (React's pattern for state that follows
  // props); toggling by hand is kept until then.
  if (state.focus !== focus) setState({ focus, open: state.open || focused });
  return (
    <Collapsible
      className={cn('flex flex-col gap-1 text-xs', className)}
      open={state.open}
      onOpenChange={(open) => {
        setState((s) => ({ ...s, open }));
      }}
      data-edit-target={target}
    >
      <CollapsibleTrigger className="flex items-center gap-1 self-start rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&[data-state=open]>svg]:rotate-90">
        <ChevronRight aria-hidden className="size-3 transition-transform" />
        {title}
        {count > 0 ? ` (${String(count)})` : ''}
      </CollapsibleTrigger>
      <CollapsibleContent className={contentClassName}>
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
