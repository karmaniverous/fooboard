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
/** Board density (spec.md C-13): padding and gaps only. */
export const DensitySchema = z.enum(['default', 'comfortable', 'compact']);
export type Density = z.infer<typeof DensitySchema>;
export const DEFAULT_DENSITY: Density = 'default';

/** 100%: the fitted layout at readable text (spec.md C-13). */
export const DEFAULT_ZOOM = 1;

/** One dashboard's view settings on this device. */
export const DashboardViewPreferencesSchema = z.object({
  /** Position on the C-13 zoom scale (see `board/layout`). */
  zoom: z.number().positive().default(DEFAULT_ZOOM),
  density: DensitySchema.default(DEFAULT_DENSITY),
  /** The board size the zoom was saved for; zoom resets when it changes. */
  boardSize: z.string().optional(),
  /** Problems dismissed on this device (spec.md A§4.3.7), by id; an id
   * carries the message, so a changed problem shows again. */
  dismissedProblems: z.array(z.string()).default(() => []),
});
export type DashboardViewPreferences = z.infer<
  typeof DashboardViewPreferencesSchema
>;

/** Light or dark (spec.md C-14): System follows the OS; saved per device. */
export const ThemeChoiceSchema = z.enum(['system', 'light', 'dark']);
export type ThemeChoice = z.infer<typeof ThemeChoiceSchema>;

export const CURRENT_DEVICE_PREFERENCES_VERSION = 2;

/** All view settings on this device. Never exported or shared. */
export const DevicePreferencesSchema = z.object({
  schemaVersion: z.literal(CURRENT_DEVICE_PREFERENCES_VERSION),
  theme: ThemeChoiceSchema.default('system'),
  dashboards: z
    .record(z.string(), DashboardViewPreferencesSchema)
    .default(() => ({})),
});
export type DevicePreferences = z.infer<typeof DevicePreferencesSchema>;

/** Version 1 stored a row height (Compact/Full) and a grid magnification. */
const V1Schema = z.object({
  schemaVersion: z.literal(1),
  dashboards: z.record(
    z.string(),
    z.object({ rowHeight: z.enum(['compact', 'full']).optional() }).loose(),
  ),
});

/**
 * Bring stored preferences to the current version (spec.md step 11a):
 * Full becomes Default, Compact stays Compact, and every saved zoom resets
 * to 100% (the old value meant grid magnification). Anything unreadable
 * gives undefined, so the caller starts afresh.
 */
export function migrateDevicePreferences(
  raw: unknown,
): DevicePreferences | undefined {
  const current = DevicePreferencesSchema.safeParse(raw);
  if (current.success) return current.data;
  const v1 = V1Schema.safeParse(raw);
  if (!v1.success) return undefined;
  return {
    schemaVersion: CURRENT_DEVICE_PREFERENCES_VERSION,
    theme: 'system',
    dashboards: Object.fromEntries(
      Object.entries(v1.data.dashboards).map(([id, view]) => [
        id,
        {
          zoom: DEFAULT_ZOOM,
          density: view.rowHeight === 'compact' ? 'compact' : 'default',
          dismissedProblems: [],
        },
      ]),
    ),
  };
}
