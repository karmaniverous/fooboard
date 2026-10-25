/**
 * Development aid (spec.md §3.5): optional simulated latency for the demo,
 * which otherwise answers at once, so its board can be timed. Open
 * `/demo?latency=300` in the dev server and the simulator delays every
 * response by 300 ms (§3.14).
 *
 * @module
 */
/** The demo URL's search parameter giving the latency in ms. */
export const DEMO_LATENCY_PARAM = 'latency';
/** The longest latency accepted (ms); longer values are capped. */
export const DEMO_LATENCY_MAX_MS = 60_000;

/** The simulated latency a URL search string asks for (0: none). */
export function demoLatencyMs(search: string): number {
  const raw = new URLSearchParams(search).get(DEMO_LATENCY_PARAM);
  const value = raw === null || raw.trim() === '' ? NaN : Number(raw);
  return Number.isFinite(value) && value > 0
    ? Math.min(value, DEMO_LATENCY_MAX_MS)
    : 0;
}
