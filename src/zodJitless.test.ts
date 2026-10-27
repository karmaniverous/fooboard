/**
 * zod runs jitless in the app (spec.md §3.10): `zodJitless.ts` sets it, and
 * `main.tsx` imports it before any module that builds a schema, so zod
 * never probes `new Function`, which the CSP reports as a violation.
 *
 * @module
 */
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import mainRaw from './main.tsx?raw';

describe('zod under the CSP', () => {
  // zod's config is global to the test worker: leave it as found.
  const before = z.config().jitless;
  afterEach(() => {
    z.config({ jitless: before });
  });

  it('is jitless once zodJitless runs', async () => {
    z.config({ jitless: false });
    await import('./zodJitless');
    expect(z.config().jitless).toBe(true);
  });

  it('is configured by the first module main.tsx imports', () => {
    const first = /^import\s+(?:[^'"]*from\s+)?['"]([^'"]+)['"]/m.exec(mainRaw);
    expect(first?.[1]).toBe('./zodJitless');
  });
});
