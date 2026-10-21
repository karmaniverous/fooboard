import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { demoDashboard } from '@/demo/board';
import { demoProviders } from '@/engine';
import { emptyModel } from '@/engine/model';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  window.history.pushState({}, '', '/');
});

describe('perf (outside development)', () => {
  it('passes providers through untouched and times nothing', async () => {
    const { useBoardTiming, withDemoLatency } = await import('./index');
    const providers = demoProviders();
    window.history.pushState({}, '', '/demo?latency=300');
    expect(withDemoLatency(providers)).toBe(providers);
    const { result } = renderHook(() => useBoardTiming(emptyModel()));
    const timing = result.current(demoDashboard, providers);
    expect(timing.providers).toBe(providers);
    expect(() => {
      timing.stop();
    }).not.toThrow();
  });
});

describe('perf (development)', () => {
  it('wraps the providers to time them, and delays the demo as the URL asks', async () => {
    vi.stubEnv('DEV', true);
    vi.stubEnv('MODE', 'development');
    const { useBoardTiming, withDemoLatency } = await import('./index');
    const providers = demoProviders();
    window.history.pushState({}, '', '/demo?latency=300');
    expect(withDemoLatency(providers)).not.toBe(providers);
    window.history.pushState({}, '', '/demo');
    expect(withDemoLatency(providers)).toBe(providers);
    const { result } = renderHook(() => useBoardTiming(emptyModel()));
    const timing = result.current(demoDashboard, providers);
    expect(timing.providers).not.toBe(providers);
    timing.stop();
  });
});
