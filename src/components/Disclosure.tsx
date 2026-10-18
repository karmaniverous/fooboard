/**
 * A collapsed section of an editor: a chevron and a title, counting what
 * is set inside so a closed section still says whether it matters.
 *
 * @module
 */
import { ChevronRight } from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

export function Disclosure({
  title,
  count,
  contentClassName,
  children,
}: {
  title: string;
  /** How many settings inside are set; shown when any. */
  count: number;
  contentClassName: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <Collapsible className="flex flex-col gap-1 text-xs">
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
