/**
 * Where a cell's tooltip goes (spec.md C-13): below the cell when it fits,
 * otherwise above, otherwise on whichever side has more room with its
 * height capped to that room; always kept inside the viewport
 * horizontally. Pure.
 *
 * @module
 */

const MARGIN = 6;

export interface Placement {
  left: number;
  top: number;
  maxHeight: number;
}

export function placeTooltip(
  anchor: { left: number; top: number; bottom: number },
  size: { width: number; height: number },
  viewport: { width: number; height: number },
): Placement {
  const left = Math.max(
    MARGIN,
    Math.min(anchor.left, viewport.width - size.width - MARGIN),
  );
  const below = viewport.height - anchor.bottom - 2 * MARGIN;
  const above = anchor.top - 2 * MARGIN;
  if (size.height <= below || below >= above) {
    return { left, top: anchor.bottom + MARGIN, maxHeight: Math.max(0, below) };
  }
  const height = Math.min(size.height, above);
  return { left, top: anchor.top - MARGIN - height, maxHeight: above };
}
