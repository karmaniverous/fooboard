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
 * The bundled status colours (spec.md A§3 *Status looks*): fills deep
 * enough for white text, plus the darker and lighter shades the *GitHub
 * deploy and test* preset uses to tell its statuses apart.
 */
export const STATUS_COLORS = {
  queued: '#e2e8f0',
  started: '#2563eb',
  testing: '#4f46e5',
  partial: '#0e7490',
  success: '#15803d',
  deployed: '#0f766e',
  failure: '#dc2626',
  testFailure: '#b91c1c',
  cancelled: '#475569',
  /** The built-in Unknown status. */
  unknown: '#a21caf',
  /** A status added in the editor, until it is given its own. */
  added: '#64748b',
} as const;

/**
 * Fixed badge colors (spec.md §3): diverged is worse than behind, so it
 * gets a more alarming, distinct color. Not user-editable.
 */
export const BADGE_COLORS = {
  behind: '#f59e0b',
  diverged: '#c2410c',
} as const;
