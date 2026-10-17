/**
 * An ordered, editable list (spec.md C-14, C-21): drag an item by its
 * handle to reorder, or use its *Move up* / *Move down* buttons (the
 * keyboard alternative); remove with confirmation.
 *
 * @module
 */
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import { useState } from 'react';

import { ConfirmButton } from '@/components/ConfirmButton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { moveItem } from './edit';

export function ReorderList<T>({
  items,
  keyOf,
  nameOf,
  onReorder,
  onRemove,
  children,
}: {
  items: readonly T[];
  keyOf: (item: T) => string;
  /** Used in button labels, e.g. "Move api up". */
  nameOf: (item: T) => string;
  onReorder: (items: T[]) => void;
  onRemove: (item: T) => void;
  /** The item's own fields. */
  children: (item: T) => React.ReactNode;
}): React.JSX.Element {
  const [dragging, setDragging] = useState<number | null>(null);
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item, index) => {
        const name = nameOf(item);
        return (
          <li
            key={keyOf(item)}
            className={cn(
              'flex flex-col gap-2 rounded-md border p-2',
              dragging === index && 'opacity-50',
            )}
            onDragOver={(e) => {
              if (dragging !== null) e.preventDefault();
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragging !== null && dragging !== index) {
                onReorder(moveItem(items, dragging, index - dragging));
              }
              setDragging(null);
            }}
          >
            <div className="flex items-center gap-1">
              <span
                draggable
                aria-hidden
                title="Drag to reorder"
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
              <span className="truncate font-medium">{name}</span>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Move ${name} up`}
                  disabled={index === 0}
                  onClick={() => {
                    onReorder(moveItem(items, index, -1));
                  }}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Move ${name} down`}
                  disabled={index === items.length - 1}
                  onClick={() => {
                    onReorder(moveItem(items, index, 1));
                  }}
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
