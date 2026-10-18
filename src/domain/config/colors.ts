/**
 * Status and badge colors (spec.md §3). Status fill colors are editable per
 * dashboard (see `StatusColorsSchema`); badge colors (behind/diverged) are
 * fixed, so they are plain constants rather than schema fields.
 *
 * @module
 */
import { z } from 'zod';

/** A `#rrggbb` hex color, the only form the status fills use. */
export const HexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'expected a #rrggbb hex color');

/**
 * Fixed badge colors (spec.md §3): diverged is worse than behind, so it
 * gets a more alarming, distinct color. Not user-editable.
 */
export const BADGE_COLORS = {
  behind: '#f59e0b',
  diverged: '#c2410c',
} as const;
