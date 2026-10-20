/**
 * An ordered, editable list (spec.md C-14, C-21): drag an item by its
 * handle to reorder, or use its *Move up* / *Move down* buttons (the
 * keyboard alternative); remove with confirmation. The owner decides what
 * a drop or a step means (rows and stages move across group edges, C-14b).
 *
 * @module
 */
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { useState } from 'react';

import { ConfirmButton } from '@/components/ConfirmButton';
import { Button } from '@/components/ui/button';
import { WithTooltip } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function ReorderList<T>({
  items,
  keyOf,
  nameOf,
  onRemove,
  onDrop,
  onStep,
  children,
  targetOf,
}: {
  items: readonly T[];
  keyOf: (item: T) => string;
  /** Used in button labels, e.g. "Move api up". */
  nameOf: (item: T) => string;
  onRemove: (item: T) => void;
  /** `from` dropped onto `to`. */
  onDrop: (from: T, to: T) => void;
  /** The move one step up or down, or undefined when it can't move
   * (the button is disabled). */
  onStep: (item: T, delta: -1 | 1) => (() => void) | undefined;
  /** The item's own fields. */
  children: (item: T) => React.ReactNode;
  /** The item's editor-item key, for the editor to open on. */
  targetOf?: (item: T) => string;
}): React.JSX.Element {
  const [dragging, setDragging] = useState<number | null>(null);
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item, index) => {
        const name = nameOf(item);
        const up = onStep(item, -1);
        const down = onStep(item, 1);
        return (
          <li
            key={keyOf(item)}
            data-edit-target={targetOf?.(item)}
            className={cn(
              'flex flex-col gap-2 rounded-md border p-2',
              dragging === index && 'opacity-50',
            )}
            onDragOver={(e) => {
              if (dragging !== null) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              const from = dragging === null ? undefined : items[dragging];
              if (from !== undefined && dragging !== index) onDrop(from, item);
              setDragging(null);
            }}
          >
            <div className="flex items-center gap-1">
              <WithTooltip label="Drag to reorder">
                <span
                  draggable
                  aria-hidden
                  className="cursor-grab text-muted-foreground"
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    setDragging(index);
                  }}
                  onDragEnd={() => {
                    setDragging(null);
                  }}
                >
                  <GripVertical className="size-4" />
                </span>
              </WithTooltip>
              <span className="truncate font-medium">{name}</span>
              <div className="ml-auto flex items-center gap-1">
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
                <ConfirmButton
                  confirmLabel={`Remove ${name}`}
                  onConfirm={() => {
                    onRemove(item);
                  }}
                >
                  Remove
                </ConfirmButton>
              </div>
            </div>
            {children(item)}
          </li>
        );
      })}
    </ol>
  );
}
