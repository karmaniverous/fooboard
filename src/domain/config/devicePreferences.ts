/**
 * Zod schema for device preferences (spec.md C-13): zoom level and row
 * height, per dashboard, per device. This is a **separate** schema from the
 * config root and is never part of an export or share link (spec.md step
 * 1, E-15).
 *
 * @module
 */
import { z } from 'zod';

/** Row height choice, independent of zoom (spec.md v0.18). */
export const RowHeightSchema = z.enum(['compact', 'full']);
export type RowHeight = z.infer<typeof RowHeightSchema>;

/** Default row height (spec.md C-13: default Compact). */
export const DEFAULT_ROW_HEIGHT: RowHeight = 'compact';

/** Default zoom level: Fit. */
export const DEFAULT_ZOOM = 1;

/** One dashboard's view preferences on this device. */
export const DashboardViewPreferencesSchema = z.object({
  zoom: z.number().positive().default(DEFAULT_ZOOM),
  rowHeight: RowHeightSchema.default(DEFAULT_ROW_HEIGHT),
  /** `rows x stages` when `zoom` was saved; zoom resets to Fit when the
   * board's size changes (spec.md C-13). */
  boardSize: z.string().optional(),
});
export type DashboardViewPreferences = z.infer<
  typeof DashboardViewPreferencesSchema
>;

/** Current device-preferences schema version. */
export const CURRENT_DEVICE_PREFERENCES_VERSION = 1;

/**
 * Device preferences root: view settings keyed by dashboard id. Never
 * exported or shared; local-storage only, per device.
 */
export const DevicePreferencesSchema = z.object({
  schemaVersion: z.literal(CURRENT_DEVICE_PREFERENCES_VERSION),
  dashboards: z
    .record(z.string(), DashboardViewPreferencesSchema)
    .default(() => ({})),
});
export type DevicePreferences = z.infer<typeof DevicePreferencesSchema>;
