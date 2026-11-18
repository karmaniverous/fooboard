/**
 * The v7 → v8 migration step (spec §3.L, Decision 113): each dashboard's
 * `settings` gains `hiddenPolling`, how the board polls while its tab is
 * hidden. A dashboard without it gets the v8 defaults, frozen here, so a
 * later default never changes what a v7 dashboard becomes; one that has
 * it keeps it, so the step is idempotent. A malformed dashboard list, or
 * a dashboard whose `settings` isn't an object, is left as it is for
 * validation to refuse (as `addSettings` does), so the store keeps it
 * read-only rather than saving an empty configuration over it.
 *
 * @module
 */
import { z } from 'zod';

/** A dashboard list as stored: absent means none. */
const DashboardListSchema = z
  .array(z.record(z.string(), z.unknown()))
  .optional();

/** A dashboard's settings as stored: absent means none set. */
const SettingsSchema = z.record(z.string(), z.unknown()).optional();

/** The hidden polling period when data model v8 was made (ms). */
const V8_HIDDEN_POLL_MS = 300_000;
/** The hidden polling ramp when data model v8 was made. */
const V8_HIDDEN_RAMP = 0.25;

/** The hidden polling v8 gives a v7 dashboard. */
const v8HiddenPolling = () => ({
  periodMs: V8_HIDDEN_POLL_MS,
  rampFactor: V8_HIDDEN_RAMP,
});

/** One dashboard, its settings given `hiddenPolling` unless they have it
 * (or aren't an object). */
function withHiddenPolling(
  dashboard: Record<string, unknown>,
): Record<string, unknown> {
  const settings = SettingsSchema.safeParse(dashboard.settings);
  if (!settings.success) return dashboard;
  return {
    ...dashboard,
    settings: { hiddenPolling: v8HiddenPolling(), ...settings.data },
  };
}

/** v7 → v8: every dashboard's settings without `hiddenPolling` gain the
 * v8 defaults. */
export const toV8 = (
  input: Record<string, unknown>,
): Record<string, unknown> => {
  const list = DashboardListSchema.safeParse(input.dashboards);
  if (!list.success) return input;
  return { ...input, dashboards: (list.data ?? []).map(withHiddenPolling) };
};
