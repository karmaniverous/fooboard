/**
 * An ordered, editable list (spec.md C-14, C-21), on dnd-kit: drag an
 * item by its handle (pointer, or Space and the arrow keys) and it moves
 * under the cursor as its collapsed header while the others slide aside;
 * the item stays dimmed in the gap where it will land and settles there
 * on drop. *Move up* / *Move down* step it too; remove asks first. The
 * owner decides what a drop or a step means (rows and stages move across
 * group edges, C-14b). Each item collapses to its header
 * (`CollapsibleItem`), at most one open at a time (`useAccordion`).
 *
 * @module
 */
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useState } from 'react';

import { ItemHeaderPreview } from '@/components/CollapsibleItem';
import { usePrefersReducedMotion } from '@/components/usePrefersReducedMotion';

import { GripIcon, SortableItem } from './SortableItem';
import { useAccordion } from './useAccordion';

/** How far (px) a pointer moves before a press on the handle becomes a
 * drag, so a click on it stays a click. */
const ACTIVATION_DISTANCE = 4;

export function ReorderList<T>({
  items,
  keyOf,
  nameOf,
  summaryOf,
  onRemove,
  onDrop,
  onStep,
  children,
  targetOf,
  holdsTargets,
}: {
  items: readonly T[];
  keyOf: (item: T) => string;
  /** Used in button labels, e.g. "Move api up". */
  nameOf: (item: T) => string;
  /** Beside the name in the header, e.g. the repo. */
  summaryOf?: (item: T) => React.ReactNode;
  onRemove: (item: T) => void;
  /** `from` dropped onto `to` (it takes `to`'s place). */
  onDrop: (from: T, to: T) => void;
  /** The move one step up or down, or undefined when it can't move
   * (the button is disabled). */
  onStep: (item: T, delta: -1 | 1) => (() => void) | undefined;
  /** The item's own fields. */
  children: (item: T) => React.ReactNode;
  /** The item's editor-item key, for the editor to open on. */
  targetOf?: (item: T) => string;
  /** Editor-item keys of what the item holds (e.g. its row group's
   * settings): the editor opening on one opens the item. */
  holdsTargets?: (item: T) => readonly string[];
}): React.JSX.Element {
  const [activeKey, setActiveKey] = useState<string | undefined>();
  const reducedMotion = usePrefersReducedMotion();
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: ACTIVATION_DISTANCE },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const accordion = useAccordion(
    items.map((item) => {
      const own = targetOf?.(item);
      return {
        key: keyOf(item),
        targets: [
          ...(own === undefined ? [] : [own]),
          ...(holdsTargets?.(item) ?? []),
        ],
      };
    }),
  );
  const byKey = (key: UniqueIdentifier | undefined) =>
    key === undefined ? undefined : items.find((i) => keyOf(i) === String(key));
  const active = byKey(activeKey);
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => {
        setActiveKey(String(e.active.id));
      }}
      onDragCancel={() => {
        setActiveKey(undefined);
      }}
      onDragEnd={({ active: dragged, over }) => {
        setActiveKey(undefined);
        const from = byKey(dragged.id);
        const to = byKey(over?.id);
        if (from !== undefined && to !== undefined && dragged.id !== over?.id)
          onDrop(from, to);
      }}
    >
      <SortableContext
        items={items.map(keyOf)}
        strategy={verticalListSortingStrategy}
      >
        <ol className="flex flex-col gap-2">
          {items.map((item) => {
            const key = keyOf(item);
            return (
              <SortableItem
                key={key}
                id={key}
                name={nameOf(item)}
                summary={summaryOf?.(item)}
                target={targetOf?.(item)}
                item={accordion.itemProps(key)}
                up={onStep(item, -1)}
                down={onStep(item, 1)}
                onRemove={() => {
                  onRemove(item);
                }}
                reducedMotion={reducedMotion}
              >
                {children(item)}
              </SortableItem>
            );
          })}
        </ol>
      </SortableContext>
      <DragOverlay {...(reducedMotion ? { dropAnimation: null } : {})}>
        {active === undefined ? null : (
          <ItemHeaderPreview
            name={nameOf(active)}
            summary={summaryOf?.(active)}
            lead={<GripIcon />}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}
