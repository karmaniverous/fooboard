/**
 * Status and badge colors (spec.md §3). Status fill colors are editable per
 * dashboard (see `StatusColorsSchema`); badge colors (behind/diverged) are
 * fixed, so they are plain constants rather than schema fields.
 *
 * @module
 */
import { z } from 'zod';

/** Default status fill colors (spec.md §3 table), editable per dashboard. */
export const DEFAULT_STATUS_COLORS = {
  queued: '#e2e8f0',
  started: '#2563eb',
  partialSuccess: '#0e7490',
  success: '#15803d',
  failure: '#dc2626',
  cancelled: '#475569',
} as const;

/** Editable status fill colors, one hex string per status (spec.md §3). */
export const StatusColorsSchema = z.object({
  queued: z.string().min(1).default(DEFAULT_STATUS_COLORS.queued),
  started: z.string().min(1).default(DEFAULT_STATUS_COLORS.started),
  partialSuccess: z
    .string()
    .min(1)
    .default(DEFAULT_STATUS_COLORS.partialSuccess),
  success: z.string().min(1).default(DEFAULT_STATUS_COLORS.success),
  failure: z.string().min(1).default(DEFAULT_STATUS_COLORS.failure),
  cancelled: z.string().min(1).default(DEFAULT_STATUS_COLORS.cancelled),
});
export type StatusColors = z.infer<typeof StatusColorsSchema>;

/**
 * Fixed badge colors (spec.md §3): diverged is worse than behind, so it
 * gets a more alarming, distinct color. Not user-editable.
 */
export const BADGE_COLORS = {
  behind: '#f59e0b',
  diverged: '#c2410c',
} as const;
