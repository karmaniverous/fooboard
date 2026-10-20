/**
 * One item of a `ReorderList` (spec.md C-14, C-21): a sortable list item
 * that slides out of the way of a dragged item (a CSS transform with a
 * transition, none under reduced motion), stays dimmed in place while it
 * is the one dragged (the placeholder where it will land), and holds the
 * item's collapsible header and fields. The drag handle is the only part
 * that starts a drag (pointer or keyboard), so fields stay clickable.
 *
 * @module
 */
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';

import {
  CollapsibleItem,
  type ItemOpenState,
} from '@/components/CollapsibleItem';
import { ConfirmButton } from '@/components/ConfirmButton';
import { Button } from '@/components/ui/button';
import { WithTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/** The drag handle's look, shared with the drag overlay's copy. */
export function GripIcon(): React.JSX.Element {
  return <GripVertical aria-hidden className="size-4 text-muted-foreground" />;
}

export function SortableItem({
  id,
  name,
  summary,
  target,
  item,
  up,
  down,
  onRemove,
  reducedMotion,
  children,
}: {
  /** The item's key in the list. */
  id: string;
  name: string;
  summary?: React.ReactNode;
  target?: string;
  item: ItemOpenState;
  /** One step up or down, or undefined when it can't move that way. */
  up: (() => void) | undefined;
  down: (() => void) | undefined;
  onRemove: () => void;
  /** No slide transitions (prefers-reduced-motion). */
  reducedMotion: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, ...(reducedMotion ? { transition: null } : {}) });
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition: reducedMotion ? undefined : transition,
      }}
      data-dragging={isDragging || undefined}
      className={cn(isDragging && 'opacity-50')}
    >
      <CollapsibleItem
        {...item}
        name={name}
        summary={summary}
        target={target}
        lead={
          <WithTooltip label="Drag to reorder">
            <Button
              ref={setActivatorNodeRef}
              size="icon"
              variant="ghost"
              className="size-6 cursor-grab touch-none"
              {...attributes}
              {...listeners}
              aria-label={`Drag ${name} to reorder`}
            >
              <GripIcon />
            </Button>
          </WithTooltip>
        }
        actions={
          <>
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Move ${name} up`}
              disabled={!up}
              onClick={up}
            >
              <ArrowUp className="size-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Move ${name} down`}
              disabled={!down}
              onClick={down}
            >
              <ArrowDown className="size-4" />
            </Button>
            <ConfirmButton confirmLabel={`Remove ${name}`} onConfirm={onRemove}>
              Remove
            </ConfirmButton>
          </>
        }
      >
        {children}
      </CollapsibleItem>
    </li>
  );
}
