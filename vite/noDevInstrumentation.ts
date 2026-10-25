/**
 * Build check (spec.md §3.5): the timing instrumentation runs in
 * development builds only, so a production bundle must contain none of
 * it, nor the TanStack Query Devtools (spec.md §3.1: development only,
 * lazily imported), nor the demo's measurement scenario (§3.14). Every timing mark, measure and console summary
 * starts with `TIMING_PREFIX`, and the Devtools bundle names itself
 * `DEVTOOLS_MARKER`; this plugin fails a production build whose output
 * contains either.
 *
 * @module
 */
import type { Plugin } from 'vite';

import { MEASURE_SCENARIO_MARKER } from '../src/demo/scenarios/marker.ts';
import { TIMING_PREFIX } from '../src/perf/targets.ts';

/** A string the TanStack Query Devtools bundle carries (its title). */
export const DEVTOOLS_MARKER = 'TanStack Query Devtools';

/** What a production bundle must not contain. */
const DEV_ONLY_MARKERS = [
  TIMING_PREFIX,
  DEVTOOLS_MARKER,
  MEASURE_SCENARIO_MARKER,
] as const;

/** The parts of a bundle output the check reads. */
interface Output {
  type: 'chunk' | 'asset';
  fileName: string;
  code?: string;
  source?: string | Uint8Array;
}

/** The files in `bundle` whose text contains `marker`. */
export function filesContaining(
  bundle: Readonly<Record<string, Output>>,
  marker: string,
): string[] {
  return Object.values(bundle)
    .filter((output) => {
      const text =
        output.type === 'chunk'
          ? output.code
          : typeof output.source === 'string'
            ? output.source
            : undefined;
      return text?.includes(marker) === true;
    })
    .map((output) => output.fileName);
}

/** Fail a production build that contains development-only code. */
export function noDevInstrumentation(
  markers: readonly string[] = DEV_ONLY_MARKERS,
): Plugin {
  return {
    name: 'fooboard:no-dev-instrumentation',
    apply: (_config, env) =>
      env.command === 'build' && env.mode === 'production',
    generateBundle(_options, bundle) {
      for (const marker of markers) {
        const found = filesContaining(bundle, marker);
        if (found.length > 0)
          this.error(
            `Development-only code ("${marker}") found in the production bundle: ${found.join(', ')}`,
          );
      }
    },
  };
}
