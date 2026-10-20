/**
 * Arranging an ordered list of items (rows or stages) and its groups
 * (spec.md C-14b, C-21), the same way on both axes. Groups stay
 * contiguous: after every change each group's members sit together at its
 * first member's place, member lists follow item order, and a group with
 * no members disappears. Pure.
 *
 * @module
 */
import type { Group } from '@/domain/config/groups';
import { freshId } from '@/lib/ids';

/** An item list and its groups, changed together. */
export interface Arranged<T extends { id: string }, G extends Group> {
  items: T[];
  groups: G[];
}

/** Which group each member id belongs to. */
export function memberIndex<G extends Pick<Group, 'memberIds'>>(
  groups: readonly G[],
): Map<string, G> {
  const index = new Map<string, G>();
  for (const g of groups) for (const id of g.memberIds) index.set(id, g);
  return index;
}

/** Items reordered so every group is contiguous, and groups synced to
 * that order (unknown ids dropped, empty groups removed). */
export function regroup<T extends { id: string }, G extends Group>(
  items: readonly T[],
  groups: readonly G[],
): Arranged<T, G> {
  const known = new Set(items.map((i) => i.id));
  const live = groups
    .map((g) => ({
      ...g,
      memberIds: g.memberIds.filter((id) => known.has(id)),
    }))
    .filter((g) => g.memberIds.length > 0);
  const index = memberIndex(live);
  const ordered: T[] = [];
  const placed = new Set<string>();
  for (const item of items) {
    const g = index.get(item.id)?.id;
    if (g === undefined) ordered.push(item);
    else if (!placed.has(g)) {
      placed.add(g);
      ordered.push(...items.filter((i) => index.get(i.id)?.id === g));
    }
  }
  const position = new Map(ordered.map((item, i) => [item.id, i]));
  const at = (id: string) => position.get(id) ?? 0;
  return {
    items: ordered,
    groups: live.map((g) => ({
      ...g,
      memberIds: [...g.memberIds].sort((a, b) => at(a) - at(b)),
    })),
  };
}

/** `id` moved into the group `target`, or out of every group. */
export function assign<G extends Group>(
  groups: readonly G[],
  id: string,
  target: string | undefined,
): G[] {
  return groups.map((g) => {
    const memberIds = g.memberIds.filter((m) => m !== id);
    return g.id === target
      ? { ...g, memberIds: [...memberIds, id] }
      : { ...g, memberIds };
  });
}

/** A group id not yet used, derived from the member it starts with. */
export function newGroupId(
  memberId: string,
  groups: readonly Pick<Group, 'id'>[],
): string {
  return freshId(
    `group-${memberId}`,
    groups.map((g) => g.id),
  );
}

/** Drag `fromId` onto `toId`: it takes the target's place and the
 * target's group (or none), so dragging across a group edge moves it into,
 * out of or between groups. */
export function dropOnto<T extends { id: string }, G extends Group>(
  { items, groups }: Arranged<T, G>,
  fromId: string,
  toId: string,
): Arranged<T, G> {
  const from = items.findIndex((i) => i.id === fromId);
  const to = items.findIndex((i) => i.id === toId);
  if (from < 0 || to < 0 || from === to) return { items, groups };
  const moved = [...items];
  moved.splice(to, 0, ...moved.splice(from, 1));
  const target = memberIndex(groups).get(toId)?.id;
  return regroup(moved, assign(groups, fromId, target));
}

/** *Move up* / *Move down* one step: an item at its group's edge first
 * leaves the group; an ungrouped item next to a group first joins it;
 * otherwise it swaps with its neighbour. Undefined when it can't move. */
export function step<T extends { id: string }, G extends Group>(
  { items, groups }: Arranged<T, G>,
  id: string,
  delta: -1 | 1,
): Arranged<T, G> | undefined {
  const i = items.findIndex((x) => x.id === id);
  if (i < 0) return undefined;
  const index = memberIndex(groups);
  const own = index.get(id)?.id;
  const at = i + delta;
  const neighbour = at >= 0 && at < items.length ? items[at] : undefined;
  const theirs = neighbour ? index.get(neighbour.id)?.id : undefined;
  if (own !== undefined && theirs !== own) {
    return regroup(items, assign(groups, id, undefined));
  }
  if (!neighbour) return undefined;
  if (own === undefined && theirs !== undefined) {
    return regroup(items, assign(groups, id, theirs));
  }
  const next = [...items];
  next[at] = items[i];
  next[i] = neighbour;
  return regroup(next, groups);
}
