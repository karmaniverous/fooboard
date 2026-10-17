/**
 * Pure group and override editing (spec.md C-14b, C-14c, C-1a, C-21).
 * Groups are kept contiguous: after any change, each group's members are
 * pulled together at its first member's place, its member list follows
 * the item order, and a group with no members disappears. A group is
 * created from a member, never empty.
 *
 * @module
 */
import type { CredentialKind } from '@/domain/config/credentials';
import type { Dashboard } from '@/domain/config/dashboard';
import type { ColumnGroup, RowGroup } from '@/domain/config/groups';

interface Group {
  id: string;
  label?: string;
  memberIds: string[];
}

/** Items reordered so every group is contiguous, and groups synced to
 * that order (unknown ids dropped, empty groups removed). */
export function regroup<T extends { id: string }, G extends Group>(
  items: readonly T[],
  groups: readonly G[],
): { items: T[]; groups: G[] } {
  const known = new Set(items.map((i) => i.id));
  const live = groups
    .map((g) => ({
      ...g,
      memberIds: g.memberIds.filter((id) => known.has(id)),
    }))
    .filter((g) => g.memberIds.length > 0);
  const groupOf = new Map<string, string>();
  for (const g of live) for (const id of g.memberIds) groupOf.set(id, g.id);
  const ordered: T[] = [];
  const placed = new Set<string>();
  for (const item of items) {
    const g = groupOf.get(item.id);
    if (g === undefined) {
      ordered.push(item);
    } else if (!placed.has(g)) {
      placed.add(g);
      ordered.push(...items.filter((i) => groupOf.get(i.id) === g));
    }
  }
  const position = new Map(ordered.map((item, i) => [item.id, i]));
  const synced = live.map((g) => ({
    ...g,
    memberIds: [...g.memberIds].sort(
      (a, b) => (position.get(a) ?? 0) - (position.get(b) ?? 0),
    ),
  }));
  return { items: ordered, groups: synced };
}

/** A group id not yet used, derived from the member it starts with. */
function newGroupId(memberId: string, groups: readonly Group[]): string {
  const taken = new Set(groups.map((g) => g.id));
  const base = `group-${memberId}`;
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${String(n)}`;
  return id;
}

/** Move `id` into `target` (a group id), out of any group (`null`), or
 * into a new group of its own (`'new'`). */
function setMembership<G extends Group>(
  groups: readonly G[],
  id: string,
  target: string | null,
  create: (groupId: string) => G,
): G[] {
  const without = groups.map((g) => ({
    ...g,
    memberIds: g.memberIds.filter((m) => m !== id),
  }));
  if (target === null) return without;
  if (target === 'new') {
    return [...without, { ...create(newGroupId(id, groups)), memberIds: [id] }];
  }
  return without.map((g) =>
    g.id === target ? { ...g, memberIds: [...g.memberIds, id] } : g,
  );
}

const withRows = (
  d: Dashboard,
  rows: Dashboard['rows'],
  rowGroups: RowGroup[],
): Dashboard => {
  const next = regroup(rows, rowGroups);
  return { ...d, rows: next.items, rowGroups: next.groups };
};

const withStages = (
  d: Dashboard,
  stages: Dashboard['stages'],
  columnGroups: ColumnGroup[],
): Dashboard => {
  const next = regroup(stages, columnGroups);
  return { ...d, stages: next.items, columnGroups: next.groups };
};

/** Put a row into a row group, out of one, or into a new one. */
export function setRowGroup(
  d: Dashboard,
  rowId: string,
  target: string | null,
): Dashboard {
  return withRows(
    d,
    d.rows,
    setMembership(d.rowGroups, rowId, target, (id) => ({
      id,
      memberIds: [],
      branchPatternOverrides: {},
      defaultCredentials: {},
    })),
  );
}

/** Put a stage into a column group, out of one, or into a new one. */
export function setColumnGroup(
  d: Dashboard,
  stageId: string,
  target: string | null,
): Dashboard {
  return withStages(
    d,
    d.stages,
    setMembership(d.columnGroups, stageId, target, (id) => ({
      id,
      memberIds: [],
    })),
  );
}

/** Rows reordered (drag or *Move*): groups stay contiguous. */
export const reorderRows = (d: Dashboard, rows: Dashboard['rows']): Dashboard =>
  withRows(d, rows, d.rowGroups);

/** Stages reordered (drag or *Move*): groups stay contiguous. */
export const reorderStages = (
  d: Dashboard,
  stages: Dashboard['stages'],
): Dashboard => withStages(d, stages, d.columnGroups);

const relabel = <G extends Group>(
  groups: readonly G[],
  id: string,
  label: string | undefined,
): G[] =>
  groups.map((g) => {
    if (g.id !== id) return g;
    const next = { ...g };
    delete next.label;
    const text = label?.trim();
    return text ? { ...next, label: text } : next;
  });

export const renameRowGroup = (
  d: Dashboard,
  id: string,
  label: string | undefined,
): Dashboard => ({ ...d, rowGroups: relabel(d.rowGroups, id, label) });

export const renameColumnGroup = (
  d: Dashboard,
  id: string,
  label: string | undefined,
): Dashboard => ({ ...d, columnGroups: relabel(d.columnGroups, id, label) });

/** Delete a row group (and its overrides); members stay, ungrouped. */
export const deleteRowGroup = (d: Dashboard, id: string): Dashboard => ({
  ...d,
  rowGroups: d.rowGroups.filter((g) => g.id !== id),
});

/** Delete a column group; members stay, ungrouped. */
export const deleteColumnGroup = (d: Dashboard, id: string): Dashboard => ({
  ...d,
  columnGroups: d.columnGroups.filter((g) => g.id !== id),
});

/** Set (or clear with an empty pattern) one stage's override in a map. */
function setOverride(
  overrides: Readonly<Record<string, string>>,
  stageId: string,
  pattern: string | undefined,
): Record<string, string> {
  const text = pattern?.trim();
  const rest = Object.fromEntries(
    Object.entries(overrides).filter(([key]) => key !== stageId),
  );
  return text ? { ...rest, [stageId]: text } : rest;
}

/** A row's own branch-pattern override for a stage (C-14c). */
export const setRowOverride = (
  d: Dashboard,
  rowId: string,
  stageId: string,
  pattern: string | undefined,
): Dashboard => ({
  ...d,
  rows: d.rows.map((r) =>
    r.id === rowId
      ? {
          ...r,
          branchPatternOverrides: setOverride(
            r.branchPatternOverrides,
            stageId,
            pattern,
          ),
        }
      : r,
  ),
});

/** A row group's branch-pattern override for a stage (C-14c). */
export const setRowGroupOverride = (
  d: Dashboard,
  groupId: string,
  stageId: string,
  pattern: string | undefined,
): Dashboard => ({
  ...d,
  rowGroups: d.rowGroups.map((g) =>
    g.id === groupId
      ? {
          ...g,
          branchPatternOverrides: setOverride(
            g.branchPatternOverrides,
            stageId,
            pattern,
          ),
        }
      : g,
  ),
});

/** A row group's default credential of one kind (C-1a). */
export const setRowGroupCredential = (
  d: Dashboard,
  groupId: string,
  kind: CredentialKind,
  credentialId: string | undefined,
): Dashboard => ({
  ...d,
  rowGroups: d.rowGroups.map((g) =>
    g.id === groupId
      ? {
          ...g,
          defaultCredentials: { ...g.defaultCredentials, [kind]: credentialId },
        }
      : g,
  ),
});

/** Does this group carry anything that is lost when it disappears? */
export const hasOverrides = (g: RowGroup): boolean =>
  Object.keys(g.branchPatternOverrides).length > 0 ||
  Boolean(g.defaultCredentials.github ?? g.defaultCredentials.aws);

/** Put `id` into an existing group, or into none. */
function assign<G extends Group>(
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

const groupIdOf = (groups: readonly Group[], id: string) =>
  groups.find((g) => g.memberIds.includes(id))?.id;

/** Drag `fromId` onto `toId` (C-14b): it takes the target's place and
 * the target's group (or none), so dragging across a group edge moves it
 * into, out of or between groups. */
function dropOnto<T extends { id: string }, G extends Group>(
  items: readonly T[],
  groups: readonly G[],
  fromId: string,
  toId: string,
): { items: T[]; groups: G[] } {
  const from = items.findIndex((i) => i.id === fromId);
  const to = items.findIndex((i) => i.id === toId);
  if (from < 0 || to < 0 || from === to)
    return { items: [...items], groups: [...groups] };
  const moved = [...items];
  moved.splice(to, 0, ...moved.splice(from, 1));
  return regroup(moved, assign(groups, fromId, groupIdOf(groups, toId)));
}

/** *Move up* / *Move down* one step (C-14b): an item at its group's edge
 * first leaves the group; an ungrouped item next to a group first joins
 * it; otherwise it swaps with its neighbour. Undefined when it can't move. */
function stepItem<T extends { id: string }, G extends Group>(
  items: readonly T[],
  groups: readonly G[],
  id: string,
  delta: -1 | 1,
): { items: T[]; groups: G[] } | undefined {
  const i = items.findIndex((x) => x.id === id);
  if (i < 0) return undefined;
  const own = groupIdOf(groups, id);
  const at = i + delta;
  const neighbour: T | undefined =
    at >= 0 && at < items.length ? items[at] : undefined;
  const theirs = neighbour ? groupIdOf(groups, neighbour.id) : undefined;
  if (own !== undefined && theirs !== own) {
    return regroup(items, assign(groups, id, undefined));
  }
  if (!neighbour) return undefined;
  if (own === undefined && theirs !== undefined) {
    return regroup(items, assign(groups, id, theirs));
  }
  const next = [...items];
  next[i] = neighbour;
  next[i + delta] = items[i];
  return regroup(next, groups);
}

/** Row and stage versions of the above, on a dashboard. */
export const dropRow = (
  d: Dashboard,
  fromId: string,
  toId: string,
): Dashboard => {
  const r = dropOnto(d.rows, d.rowGroups, fromId, toId);
  return { ...d, rows: r.items, rowGroups: r.groups };
};
export const dropStage = (
  d: Dashboard,
  fromId: string,
  toId: string,
): Dashboard => {
  const r = dropOnto(d.stages, d.columnGroups, fromId, toId);
  return { ...d, stages: r.items, columnGroups: r.groups };
};
export const stepRow = (
  d: Dashboard,
  id: string,
  delta: -1 | 1,
): Dashboard | undefined => {
  const r = stepItem(d.rows, d.rowGroups, id, delta);
  return r && { ...d, rows: r.items, rowGroups: r.groups };
};
export const stepStage = (
  d: Dashboard,
  id: string,
  delta: -1 | 1,
): Dashboard | undefined => {
  const r = stepItem(d.stages, d.columnGroups, id, delta);
  return r && { ...d, stages: r.items, columnGroups: r.groups };
};
