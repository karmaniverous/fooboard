import { createRequire } from 'node:module';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { manualChunks } from './chunks';

/** A module id as Rollup gives it: absolute, with forward slashes. */
const rollupId = (file: string): string => file.replaceAll('\\', '/');

const root = path.resolve(import.meta.dirname, '..');
const zod = createRequire(import.meta.url).resolve('zod');
const zodJitless = path.join(root, 'src', 'zodJitless.ts');

describe('manualChunks', () => {
  it('puts zod in a vendor chunk', () => {
    expect(manualChunks(rollupId(zod))).toBeDefined();
  });

  it.each([
    ['as Rollup gives it', rollupId(zodJitless)],
    ['with Windows separators', zodJitless.replaceAll('/', '\\')],
  ])('puts src/zodJitless.ts in zod’s chunk, %s', (_form, id) => {
    expect(manualChunks(id)).toBe(manualChunks(rollupId(zod)));
  });

  it('leaves the app’s other modules, zodJitless’s test and its raw text to Rollup', () => {
    expect(manualChunks(`${rollupId(zodJitless)}?raw`)).toBe(undefined);
    expect(manualChunks(rollupId(path.join(root, 'src', 'main.tsx')))).toBe(
      undefined,
    );
    expect(
      manualChunks(rollupId(path.join(root, 'src', 'zodJitless.test.ts'))),
    ).toBe(undefined);
  });

  it.each([
    ['react-dom', 'react-vendor'],
    ['@aws-sdk/client-amplify', 'aws-amplify'],
    ['lucide-react', 'ui-vendor'],
    ['json-p3', 'data-vendor'],
  ])('puts %s in %s', (pkg, chunk) => {
    expect(
      manualChunks(rollupId(path.join(root, 'node_modules', pkg, 'index.js'))),
    ).toBe(chunk);
  });
});
