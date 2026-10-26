/**
 * Group frames and boundary lines (spec.md §3.7, Decision 13), each drawn
 * once in the gutters `groupGutters` lays out, never as borders on cells:
 *
 * - **A column group's frame** is one element spanning every grid row
 *   (`grid-row: 1 / -1`) from the gutter on its left to the gutter on its
 *   right, its side lines centred in those gutters and its top line along
 *   the top of the grid, so it is continuous from the label strip to the
 *   last body row and never touches a card.
 * - **A row-group boundary** is one line across every column, centred in
 *   the gutter row between two row segments, or, where the segment below
 *   has a label row, in the band above its label (`rowLineInLabel`).
 *
 * Both are decoration: hidden from assistive technology (spec.md §3.10)
 * and from the pointer, in the theme's frame colour (`--frame`, at least
 * 3:1 on the background in light and dark), and drawn as borders on solid
 * backgrounds, which Windows high-contrast mode (forced colours) keeps:
 * it drops background images and shadows and paints background colours
 * as its canvas. Where a row line crosses the
 * pinned row-name column, a cover pinned with it (`PinnedCover`) hides
 * the frames passing under the column when the board scrolls right, and
 * carries its own piece of the line, so the line stays whole.
 *
 * @module
 */
import { cn } from '@/lib/utils';

import { FRAME_LAYER, PIN_ABOVE_FRAMES } from './gridStyles';
import { type ColumnFrame, FRAME_LINE_PX } from './groupGutters';

/** One frame per column group, laid over the grid (which is `relative`,
 * so each is placed in its grid area). */
export function ColumnFrames({
  frames,
  gutter,
}: {
  frames: readonly ColumnFrame<{ id: string }>[];
  /** The gutter's spacer track, in px: the lines sit in its middle. */
  gutter: number;
}): React.JSX.Element {
  const inset = (gutter - FRAME_LINE_PX) / 2;
  return (
    <>
      {frames.map((f) => (
        <div
          key={f.group.id}
          aria-hidden
          data-frame={f.group.id}
          className={cn(
            'pointer-events-none absolute border-solid border-frame',
            FRAME_LAYER,
          )}
          style={{
            gridColumn: `${String(f.from)} / ${String(f.to)}`,
            gridRow: '1 / -1',
            top: 0,
            bottom: 0,
            left: inset,
            right: inset,
            borderWidth: `${String(FRAME_LINE_PX)}px ${String(FRAME_LINE_PX)}px 0`,
          }}
        />
      ))}
    </>
  );
}

/** A row boundary's line across what holds it (which is positioned),
 * `top` px from its top: a top border, so forced colours keep it. */
export function RowLine({
  top,
  className,
  ...rest
}: {
  top: number;
  /** Its horizontal extent. */
  className: string;
  'data-boundary'?: 'row';
}): React.JSX.Element {
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute border-solid border-frame',
        className,
      )}
      style={{ top, borderTopWidth: FRAME_LINE_PX }}
      {...rest}
    />
  );
}

/** Pinned with the row-name column, over the frames (spec.md §3.7), on a
 * row with no row header: exactly the row-name column wide, a solid
 * background down through the gap below as the row headers' is
 * (`PIN_LEFT`), so a frame never shows through the pinned column; a
 * longer label overflows it without hiding the frames beside the column.
 * Where a row line crosses, it carries its own piece of the line, so the
 * line stays whole. A flex item (`self-start`), so it is as tall as its
 * row plus the gap. */
export function PinnedCover({
  lineTop,
  className,
  children,
}: {
  /** The row line crossing it, if any, from its top (px). */
  lineTop?: number;
  className?: string;
  children?: React.ReactNode;
}): React.JSX.Element {
  return (
    <span
      className={cn(
        'sticky left-0 flex w-[var(--row-name-w)] shrink-0 items-end self-start bg-background',
        PIN_ABOVE_FRAMES,
        className,
      )}
      style={{
        height: 'calc(100% + var(--grid-gap))',
        paddingBottom: 'var(--grid-gap)',
      }}
    >
      {lineTop !== undefined && <RowLine top={lineTop} className="inset-x-0" />}
      {children}
    </span>
  );
}

/** The gutter row at a boundary above an unlabelled segment: one line
 * across every column, centred in the gutter, and the pinned cover. */
export function RowGutter({
  gutter,
}: {
  /** The gutter's height, in px. */
  gutter: number;
}): React.JSX.Element {
  const top = (gutter - FRAME_LINE_PX) / 2;
  return (
    <div
      aria-hidden
      className="pointer-events-none relative flex"
      style={{ gridColumn: '1 / -1' }}
    >
      <RowLine top={top} data-boundary="row" className="inset-x-0" />
      <PinnedCover lineTop={top} />
    </div>
  );
}
