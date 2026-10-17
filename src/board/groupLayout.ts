/**
 * Row and column group segmentation for the board (spec.md C-14b): groups
 * replace dividers. A segment is a maximal run of adjacent items that
 * belong to the same group (or to no group); a boundary line is drawn at
 * every segment start after the first, and a label row/strip is drawn for
 * segments whose group has a label. Pure.
 *
 * @module
 */

/** One run of adjacent items sharing a group (or `group` undefined for an
 * ungrouped run). */
export interface GroupSegment<G> {
  group?: G;
  start: number;
  span: number;
}

/** Segment `itemIds`, in order, by the group (if any) each belongs to. */
export function groupSegments<
  G extends { id: string; label?: string; memberIds: readonly string[] },
>(itemIds: readonly string[], groups: readonly G[]): GroupSegment<G>[] {
  const groupOf = new Map<string, G>();
  for (const g of groups) {
    for (const id of g.memberIds) groupOf.set(id, g);
  }
  const segments: GroupSegment<G>[] = [];
  itemIds.forEach((id, i) => {
    const g = groupOf.get(id);
    const current = segments.at(-1);
    if (current && current.group?.id === g?.id) {
      current.span += 1;
    } else {
      segments.push({ group: g, start: i, span: 1 });
    }
  });
  return segments;
}
