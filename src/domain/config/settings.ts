/**
 * Dashboard settings (spec.md §3.2–3.3, §3.11; Decisions 10 and 51): the
 * shared settings object (`SettingsSchema`) at the dashboard level, beside
 * requests in flight per credential, one setting per platform, which
 * stays dashboard-only and is not part of the shared object. Each GitHub
 * token and each AWS key of the dashboard may have this many requests
 * running at once, per tab. Higher fills the board faster; bursts can trigger the
 * provider's secondary limits or throttling; 1 sends one at a time.
 *
 * Beside it, also dashboard-only, how the board polls while its tab is
 * hidden (spec §3.L, Decision 113; data model v8): each row's interval
 * grows by `rampFactor` after every hidden poll, from its own interval up
 * to `periodMs`, the hidden polling period.
 *
 * @module
 */
import { z } from 'zod';

import { SettingsSchema } from '@/domain/settings/schema';

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

/** The shortest hidden polling period: the visible idle interval
 * (`IDLE_INTERVAL_MS`, 60 s), since a shorter one would ask a hidden row
 * to poll faster than an idle visible one. */
export const HIDDEN_POLL_MIN_MS = 60_000;
/** The longest hidden polling period, an hour: past it the return's
 * re-read does nearly all the work, as if nothing polled while hidden. */
export const HIDDEN_POLL_MAX_MS = 60 * 60_000;
/** The hidden polling period unless set (Decision 113): 5 minutes, about
 * 240 reads an hour for an idle 20-row board, against 1,200 visible. */
export const DEFAULT_HIDDEN_POLL_MS = 5 * 60_000;

/** The smallest hidden polling ramp: the 1% step the editor offers.
 * Nearer 0, a row polling every 5 s would go on near 5 s for hours. */
export const HIDDEN_RAMP_MIN = 0.01;
/** The largest hidden polling ramp: the interval doubling each poll, the
 * poll boost's own growth. Beyond it the period is reached in a poll or
 * two, which a shorter period says more plainly. */
export const HIDDEN_RAMP_MAX = 1;
/** The hidden polling ramp unless set (Decision 113): 25% per poll, so an
 * idle row reaches the default period in 8 polls, about 20 minutes. */
export const DEFAULT_HIDDEN_RAMP = 0.25;

/** How the board polls while its tab is hidden, defaulted field by
 * field. */
const HiddenPollingSchema = z.object({
  /** The hidden polling period (ms): where each row's ramp stops. */
  periodMs: z
    .number()
    .int()
    .min(HIDDEN_POLL_MIN_MS)
    .max(HIDDEN_POLL_MAX_MS)
    .default(DEFAULT_HIDDEN_POLL_MS),
  /** Each hidden poll's interval is the last one times (1 + this). */
  rampFactor: z
    .number()
    .min(HIDDEN_RAMP_MIN)
    .max(HIDDEN_RAMP_MAX)
    .default(DEFAULT_HIDDEN_RAMP),
});
export type HiddenPolling = z.infer<typeof HiddenPollingSchema>;

/** A dashboard's settings: the shared object, and the dashboard-only
 * requests in flight and hidden polling, defaulted field by field. */
export const DashboardSettingsSchema = SettingsSchema.extend({
  requestsInFlight: z
    .object({ github: RequestsInFlightSchema, aws: RequestsInFlightSchema })
    .default(() => defaultRequestsInFlight()),
  hiddenPolling: HiddenPollingSchema.default(() => defaultHiddenPolling()),
});
export type DashboardSettings = z.infer<typeof DashboardSettingsSchema>;

/** Every platform at the default. */
const defaultRequestsInFlight = (): Record<CredentialKind, number> => ({
  github: DEFAULT_REQUESTS_IN_FLIGHT,
  aws: DEFAULT_REQUESTS_IN_FLIGHT,
});

/** Hidden polling at the defaults. */
const defaultHiddenPolling = (): HiddenPolling => ({
  periodMs: DEFAULT_HIDDEN_POLL_MS,
  rampFactor: DEFAULT_HIDDEN_RAMP,
});

/** Settings with every default. */
export const defaultSettings = (): DashboardSettings => ({
  requestsInFlight: defaultRequestsInFlight(),
  hiddenPolling: defaultHiddenPolling(),
});

/** The dashboard-only fields of `settings` (not part of the shared
 * settings object): what an edit of the shared object keeps. */
export const dashboardOnly = ({
  requestsInFlight,
  hiddenPolling,
}: DashboardSettings): Pick<
  DashboardSettings,
  'requestsInFlight' | 'hiddenPolling'
> => ({ requestsInFlight, hiddenPolling });

/** A hidden polling period held to the allowed range, in whole
 * milliseconds. */
export const clampHiddenPollMs = (ms: number): number =>
  Math.min(HIDDEN_POLL_MAX_MS, Math.max(HIDDEN_POLL_MIN_MS, Math.round(ms)));

/** A hidden polling ramp held to the allowed range. */
export const clampHiddenRamp = (factor: number): number =>
  Math.min(HIDDEN_RAMP_MAX, Math.max(HIDDEN_RAMP_MIN, factor));

/** `value` held to the allowed range, as a whole number. */
export const clampRequestsInFlight = (value: number): number =>
  Math.min(
    REQUESTS_IN_FLIGHT_MAX,
    Math.max(REQUESTS_IN_FLIGHT_MIN, Math.round(value)),
  );
