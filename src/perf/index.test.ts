import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { demoDashboard } from '@/demo/board';
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
    expect(demoLatency()).toBeUndefined();
    const { result } = renderHook(() => useBoardTiming(emptyModel()));
    const timing = result.current(demoDashboard);
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
    expect(demoLatency()).toBeDefined();
    window.history.pushState({}, '', '/demo');
    expect(demoLatency()).toBeUndefined();
    const { result } = renderHook(() => useBoardTiming(emptyModel()));
    const timing = result.current(demoDashboard);
    expect(timing.around).not.toBe(passThrough);
    timing.stop();
  });
});
