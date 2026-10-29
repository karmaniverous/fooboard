/**
 * The build's vendor chunks: heavy, rarely-changing vendor code, each
 * group its own cacheable chunk. React, the AWS SDK, the UI kit (Radix,
 * dnd-kit, icons) and the data libraries (schemas, JSONPath, utilities).
 *
 * `src/zodJitless.ts` goes with zod: it must run before any module builds
 * a schema, and a chunk the entry imports (shared app code, built-in
 * rules included) runs before the entry's own code, but after zod's
 * (spec.md §3.10, the CSP). `chunks.test.ts` holds it there.
 *
 * @module
 */

const VENDOR_CHUNKS: readonly [RegExp, string][] = [
  [
    /node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/,
    'react-vendor',
  ],
  [/node_modules[\\/]@aws-sdk[\\/]/, 'aws-amplify'],
  [/node_modules[\\/](@radix-ui|@dnd-kit|lucide-react)[\\/]/, 'ui-vendor'],
  [
    /node_modules[\\/](zod|json-p3|radash)[\\/]|src[\\/]zodJitless\.ts$/,
    'data-vendor',
  ],
];

/** The vendor chunk module `id` goes in, if any (Rollup's
 * `manualChunks`). */
export function manualChunks(id: string): string | undefined {
  return VENDOR_CHUNKS.find(([pattern]) => pattern.test(id))?.[1];
}
