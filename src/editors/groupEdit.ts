/**
 * Group editing on a dashboard (spec.md C-14b, C-21), the same on both
 * axes: rows with row groups, stages with column groups. Each change goes
 * through the domain's `arrange` rules, so groups stay contiguous and
 * disappear with their last member. A group is created from a member,
 * never empty. Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import type { Group } from '@/domain/config/groups';
import {
  type Arranged,
  assign,
  dropOnto,
  newGroupId,
  regroup,
  step,
} from '@/domain/groups/arrange';

/** Rows (with row groups) or stages (with column groups). */
export type GroupAxis = 'rows' | 'stages';

/** A change to one axis; `create` makes an empty group of its kind. */
type Change = <T extends { id: string }, G extends Group>(
  arranged: Arranged<T, G>,
  create: (id: string) => G,
) => Arranged<T, G> | undefined;

/** Apply `change` to one axis of `d`; undefined when it can't apply. */
function onAxis(
  d: Dashboard,
  axis: GroupAxis,
  change: Change,
): Dashboard | undefined {
  if (axis === 'rows') {
    const next = change({ items: d.rows, groups: d.rowGroups }, (id) => ({
      id,
      memberIds: [],
      branchPatternOverrides: {},
      defaultCredentials: {},
    }));
    return next && { ...d, rows: next.items, rowGroups: next.groups };
  }
  const next = change({ items: d.stages, groups: d.columnGroups }, (id) => ({
    id,
    memberIds: [],
  }));
  return next && { ...d, stages: next.items, columnGroups: next.groups };
}

/** `onAxis` for changes that always apply. */
const always = (d: Dashboard, axis: GroupAxis, change: Change): Dashboard =>
  onAxis(d, axis, change) ?? d;

/** The groups on one axis. */
export const groupsOn = (d: Dashboard, axis: GroupAxis): readonly Group[] =>
  axis === 'rows' ? d.rowGroups : d.columnGroups;

/** Groups synced to the current items (after a removal, say). */
export const tidyGroups = (d: Dashboard, axis: GroupAxis): Dashboard =>
  always(d, axis, (a) => regroup(a.items, a.groups));

/** Put an item into a group (`target` id), out of every group (`null`),
 * or into a new group of its own (`'new'`). */
export const setGroup = (
  d: Dashboard,
  axis: GroupAxis,
  itemId: string,
  target: string | null,
): Dashboard =>
  always(d, axis, ({ items, groups }, create) => {
    if (target !== 'new') {
      return regroup(items, assign(groups, itemId, target ?? undefined));
    }
    const group = {
      ...create(newGroupId(itemId, groups)),
      memberIds: [itemId],
    };
    return regroup(items, [...assign(groups, itemId, undefined), group]);
  });

/** Label a group; an empty label removes it. */
export const renameGroup = (
  d: Dashboard,
  axis: GroupAxis,
  groupId: string,
  label: string,
): Dashboard =>
  always(d, axis, ({ items, groups }) => ({
    items,
    groups: groups.map((g) =>
      g.id === groupId ? { ...g, label: label.trim() || undefined } : g,
    ),
  }));

/** Delete a group (and, for a row group, its overrides and
 * credentials); its members stay, ungrouped. */
export const deleteGroup = (
  d: Dashboard,
  axis: GroupAxis,
  groupId: string,
): Dashboard =>
  always(d, axis, ({ items, groups }) => ({
    items,
    groups: groups.filter((g) => g.id !== groupId),
  }));

/** Drag `fromId` onto `toId`: its place and its group (C-14b). */
const dropItem = (
  d: Dashboard,
  axis: GroupAxis,
  fromId: string,
  toId: string,
): Dashboard => always(d, axis, (a) => dropOnto(a, fromId, toId));

/** *Move up* / *Move down* one step across group edges (C-14b);
 * undefined when the item can't move that way. */
const stepItem = (
  d: Dashboard,
  axis: GroupAxis,
  itemId: string,
  delta: -1 | 1,
): Dashboard | undefined => onAxis(d, axis, (a) => step(a, itemId, delta));

/** `ReorderList` handlers for one axis: drops and steps that respect
 * groups, each committed through `onChange`. */
export function listHandlers(
  d: Dashboard,
  axis: GroupAxis,
  onChange: (dashboard: Dashboard) => void,
): {
  onDrop: (from: { id: string }, to: { id: string }) => void;
  onStep: (item: { id: string }, delta: -1 | 1) => (() => void) | undefined;
} {
  return {
    onDrop: (from, to) => {
      onChange(dropItem(d, axis, from.id, to.id));
    },
    onStep: (item, delta) => {
      const next = stepItem(d, axis, item.id, delta);
      return next
        ? () => {
            onChange(next);
          }
        : undefined;
    },
  };
}
