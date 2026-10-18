/**
 * Where the board draws vertical lines for column groups (spec.md C-14b):
 * a column group is framed down both sides of its header, and lines run
 * down the body at every group boundary, including a group's outer edges.
 * Pure, so the rules are tested without rendering.
 *
 * @module
 */
import type { GroupSegment } from '@/domain/groups/segments';

/** The sides of each stage's header and body cells that carry a line. */
export interface ColumnLines {
  /** Stage ids whose header has a left/right frame side. */
  headerLeft: ReadonlySet<string>;
  headerRight: ReadonlySet<string>;
  /** Stage ids whose body cells have a left/right line. */
  bodyLeft: ReadonlySet<string>;
  bodyRight: ReadonlySet<string>;
}

export function columnLines(
  segments: readonly GroupSegment<unknown>[],
  stageIds: readonly string[],
): ColumnLines {
  const headerLeft = new Set<string>();
  const headerRight = new Set<string>();
  const bodyLeft = new Set<string>();
  const bodyRight = new Set<string>();
  // Segments are built from `stageIds`, so their indices are in range.
  segments.forEach((s, i) => {
    const first = stageIds[s.start];
    const last = stageIds[s.start + s.span - 1];
    // Every boundary between segments, and a group's own left edge.
    if (i > 0 || s.group) bodyLeft.add(first);
    if (!s.group) return;
    headerLeft.add(first);
    headerRight.add(last);
    // A group's right edge: the next segment's left line covers it,
    // unless the group ends the board.
    if (i === segments.length - 1) bodyRight.add(last);
  });
  return { headerLeft, headerRight, bodyLeft, bodyRight };
}
