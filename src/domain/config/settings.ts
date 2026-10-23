/**
 * Dashboard settings (spec.md §3.2–3.3, Decision 10): requests in flight
 * per credential, one setting per platform. Each GitHub token and each
 * AWS key of the dashboard may have this many requests running at once,
 * per tab. Higher fills the board faster; bursts can trigger the
 * provider's secondary limits or throttling; 1 sends one at a time.
 *
 * @module
 */
import { z } from 'zod';

import type { CredentialKind } from './credentials';

/** The fewest and most requests in flight a setting allows. */
export const REQUESTS_IN_FLIGHT_MIN = 1;
export const REQUESTS_IN_FLIGHT_MAX = 100;
/** Requests in flight per credential unless set (Decision 10). */
export const DEFAULT_REQUESTS_IN_FLIGHT = 10;

const RequestsInFlightSchema = z
  .number()
  .int()
  .min(REQUESTS_IN_FLIGHT_MIN)
  .max(REQUESTS_IN_FLIGHT_MAX)
  .default(DEFAULT_REQUESTS_IN_FLIGHT);

/** A dashboard's settings, defaulted field by field. */
export const DashboardSettingsSchema = z.object({
  requestsInFlight: z
    .object({ github: RequestsInFlightSchema, aws: RequestsInFlightSchema })
    .default(() => defaultRequestsInFlight()),
});
export type DashboardSettings = z.infer<typeof DashboardSettingsSchema>;

/** Every platform at the default. */
const defaultRequestsInFlight = (): Record<CredentialKind, number> => ({
  github: DEFAULT_REQUESTS_IN_FLIGHT,
  aws: DEFAULT_REQUESTS_IN_FLIGHT,
});

/** Settings with every default. */
export const defaultSettings = (): DashboardSettings => ({
  requestsInFlight: defaultRequestsInFlight(),
});

/** `value` held to the allowed range, as a whole number. */
export const clampRequestsInFlight = (value: number): number =>
  Math.min(
    REQUESTS_IN_FLIGHT_MAX,
    Math.max(REQUESTS_IN_FLIGHT_MIN, Math.round(value)),
  );
