import { describe, expect, it } from 'vitest';

import { demoProviders } from '@/engine';

import {
  DEMO_LATENCY_MAX_MS,
  DEMO_LATENCY_PARAM,
  demoLatencyMs,
  withLatency,
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

describe('withLatency', () => {
  it('waits the latency before each request, then answers as before', async () => {
    const inner = demoProviders(() => 0);
    const events: string[] = [];
    const wait = (ms: number) => {
      events.push(`wait ${String(ms)}`);
      return Promise.resolve();
    };
    const slow = withLatency(inner, 300, wait);
    const ref = { owner: 'acme', repo: 'api-core' };
    const runs = await slow.github('t')?.listWorkflowRuns(ref);
    events.push('answered');
    expect(runs).toEqual(await inner.github('t')?.listWorkflowRuns(ref));
    await slow
      .amplify('k')?.({ credentialId: 'k', region: 'us-east-1' })
      .listBranches('d1demomarketing');
    expect(events).toEqual(['wait 300', 'answered', 'wait 300']);
  });

  it('leaves the providers untouched without latency', () => {
    const inner = demoProviders(() => 0);
    expect(withLatency(inner, 0)).toBe(inner);
  });
});
