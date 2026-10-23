/**
 * The refreshing mark (spec.md §3.1): a pulsing dot in the corner of a
 * cell showing cached data while newer data loads. An overlay, so it never
 * changes the cell's size.
 *
 * @module
 */
import type { BoardCell } from '@/engine';

/** The refreshing dot, in the cell's top-right corner. */
export function RefreshingDot({
  cell,
}: {
  cell: Pick<BoardCell, 'refreshing'>;
}): React.JSX.Element | null {
  if (!cell.refreshing) return null;
  return (
    <span
      aria-hidden
      data-testid="refreshing-mark"
      className="pointer-events-none absolute right-[0.25em] top-[0.25em] size-[0.4em] animate-pulse rounded-full bg-current opacity-80"
    />
  );
}
