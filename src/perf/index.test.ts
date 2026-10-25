import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { measureBoard } from '@/demo/scenarios/measure';
import { emptyModel } from '@/engine/model';
import { passThrough } from '@/query/instrument';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  window.history.pushState({}, '', '/');
});

describe('perf (outside development)', () => {
  it('passes requests straight through and times nothing', async () => {
    const { useBoardTiming, demoLatency } = await import('./index');
    window.history.pushState({}, '', '/demo?latency=300');
    expect(demoLatency()).toBe(0);
    const { result } = renderHook(() => useBoardTiming(emptyModel()));
    const timing = result.current(measureBoard);
    expect(timing.around).toBe(passThrough);
    expect(() => {
      timing.stop();
    }).not.toThrow();
  });
});

describe('perf (development)', () => {
  it('times requests, and delays the demo as the URL asks', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('MODE', 'development');
    const { useBoardTiming, demoLatency } = await import('./index');
    window.history.pushState({}, '', '/demo?latency=300');
    expect(demoLatency()).toBe(300);
    window.history.pushState({}, '', '/demo');
    expect(demoLatency()).toBe(0);
    const { result } = renderHook(() => useBoardTiming(emptyModel()));
    const timing = result.current(measureBoard);
    expect(timing.around).not.toBe(passThrough);
    timing.stop();
  });
});
