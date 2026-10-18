/**
 * Group segmentation for the board (spec.md C-14b): a segment is a
 * maximal run of adjacent items that belong to the same group (or to no
 * group). The board draws a boundary line at every segment start after
 * the first, and a label row or strip for segments whose group has a
 * label. Pure.
 *
 * @module
 */
import type { Group } from '@/domain/config/groups';

import { memberIndex } from './arrange';

/** One run of adjacent items sharing a group (`group` undefined for an
 * ungrouped run). */
export interface GroupSegment<G> {
  group?: G;
  start: number;
  span: number;
}

/** Segment `itemIds`, in order, by the group (if any) each belongs to. */
export function groupSegments<G extends Group>(
  itemIds: readonly string[],
  groups: readonly G[],
): GroupSegment<G>[] {
  const index = memberIndex(groups);
  const segments: GroupSegment<G>[] = [];
  itemIds.forEach((id, i) => {
    const group = index.get(id);
    const current = segments.at(-1);
    if (current && current.group?.id === group?.id) current.span += 1;
    else segments.push({ group, start: i, span: 1 });
  });
  return segments;
}
