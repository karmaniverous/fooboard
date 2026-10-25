/**
 * The simulator's transport (spec.md §3.14, Decision 53): a `fetch` that
 * answers GitHub's API host (the transport's base) and Amplify's regional
 * endpoints from the scenario's world at the clock's time, and fails
 * every other URL as a network error, so no request leaves the browser in
 * the demo. Simulated time is the clock's time since the simulator was
 * made (the demo's opening). The optional latency (development's
 * `?latency=`) and a pinned run's slow jobs delay a response; a request
 * aborted meanwhile rejects as `fetch` does.
 *
 * @module
 */
import { AMPLIFY_REGIONS } from '@/lib/amplify/regions';
import { GITHUB_API_BASE, type Transport } from '@/lib/transport';

import { amplifyAnswer } from './amplify';
import { createRateBook, githubAnswer, type SimWorld } from './github';
import { type SimAnswer, toResponse } from './http';
import type { DemoScenario } from './scenario';

/** Wait `ms`; rejects if `signal` aborts first. */
export type Wait = (ms: number, signal: AbortSignal) => Promise<void>;

/** The real wait. */
const sleep: Wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(
          signal.reason instanceof Error
            ? signal.reason
            : new DOMException('Aborted', 'AbortError'),
        );
      },
      { once: true },
    );
  });

export interface SimulatorOptions {
  /** The world's seed; the scenario's own unless given. */
  seed?: number;
  /** Wall-clock ms; the browser's unless given (tests step a fake). */
  clock?: () => number;
  /** Delay every response by this much (development's `?latency=`). */
  latencyMs?: number;
  wait?: Wait;
  /** Each token's hourly GitHub budget; GitHub's unless given. */
  rateLimit?: number;
}

/** An Amplify regional endpoint's host, with its region. */
const AMPLIFY_HOST = /^amplify\.([a-z0-9-]+)\.amazonaws\.com$/;
const REGIONS: ReadonlySet<string> = new Set(AMPLIFY_REGIONS);

/** A network failure, as the browser's `fetch` reports one. */
const networkError = (url: string) =>
  new TypeError(`Failed to fetch: the demo answers no request to ${url}`);

/** A transport answering from `scenario`'s simulated world. */
export function createSimulator(
  scenario: DemoScenario,
  {
    seed = scenario.seed,
    clock = Date.now,
    latencyMs = 0,
    wait = sleep,
    rateLimit,
  }: SimulatorOptions = {},
): Transport {
  const origin = clock();
  const world: SimWorld = { scenario, seed, at: (t) => origin + t };
  const rates = createRateBook(rateLimit);
  const base = new URL(GITHUB_API_BASE);

  const answer = (request: Request): SimAnswer | undefined => {
    const url = new URL(request.url);
    const t = clock() - origin;
    if (request.method !== 'GET') return undefined;
    if (url.origin === base.origin && url.pathname.startsWith(base.pathname)) {
      const path = url.pathname.slice(base.pathname.replace(/\/$/, '').length);
      return githubAnswer(
        world,
        rates,
        { url, path, headers: request.headers },
        t,
        GITHUB_API_BASE,
      );
    }
    const region = AMPLIFY_HOST.exec(url.hostname)?.[1];
    if (
      url.protocol === 'https:' &&
      region !== undefined &&
      REGIONS.has(region)
    )
      return amplifyAnswer(world, region, { url, headers: request.headers }, t);
    return undefined;
  };

  return {
    githubApiBase: GITHUB_API_BASE,
    fetch: async (input, init) => {
      const request = new Request(input, init);
      const found = answer(request);
      if (!found) throw networkError(request.url);
      const delay = latencyMs + (found.delayMs ?? 0);
      if (delay > 0) await wait(delay, request.signal);
      if (request.signal.aborted)
        throw new DOMException('Aborted', 'AbortError');
      return toResponse(found);
    },
  };
}
