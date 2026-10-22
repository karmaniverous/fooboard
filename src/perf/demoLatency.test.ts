import { describe, expect, it } from 'vitest';

import type { RequestCall } from '@/query/instrument';

import {
  DEMO_LATENCY_MAX_MS,
  DEMO_LATENCY_PARAM,
  demoLatencyMs,
  latencyAround,
} from './demoLatency';

describe('demoLatencyMs', () => {
  it('reads a positive number of ms from the URL, capped', () => {
    expect(demoLatencyMs(`?${DEMO_LATENCY_PARAM}=300`)).toBe(300);
    expect(demoLatencyMs(`?x=1&${DEMO_LATENCY_PARAM}=12.5`)).toBe(12.5);
    expect(demoLatencyMs(`?${DEMO_LATENCY_PARAM}=999999999`)).toBe(
      DEMO_LATENCY_MAX_MS,
    );
  });

  it('means no latency when absent, empty, negative or not a number', () => {
    for (const search of [
      '',
      `?${DEMO_LATENCY_PARAM}=`,
      `?${DEMO_LATENCY_PARAM}=-5`,
      `?${DEMO_LATENCY_PARAM}=fast`,
      `?${DEMO_LATENCY_PARAM}=Infinity`,
    ])
      expect(demoLatencyMs(search)).toBe(0);
  });
});

const call: RequestCall = {
  provider: 'github',
  kind: 'runs',
  credentialId: 't',
  repo: 'acme/api',
};

describe('latencyAround', () => {
  it('waits the latency before each request, then answers as it does', async () => {
    const events: string[] = [];
    const wait = (ms: number) => {
      events.push(`wait ${String(ms)}`);
      return Promise.resolve();
    };
    const around = latencyAround(300, wait);
    const answer = await around?.(call, () => {
      events.push('request');
      return Promise.resolve(42);
    });
    expect(answer).toBe(42);
    expect(events).toEqual(['wait 300', 'request']);
  });

  it('is absent without latency', () => {
    expect(latencyAround(0)).toBeUndefined();
  });
});
