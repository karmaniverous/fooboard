import { describe, expect, it } from 'vitest';

import {
  DEMO_LATENCY_MAX_MS,
  DEMO_LATENCY_PARAM,
  demoLatencyMs,
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
