/**
 * Build check (spec.md §3.5): the timing instrumentation runs in
 * development builds only, so a production bundle must contain none of
 * it. Every timing mark, measure and console summary starts with
 * `TIMING_PREFIX`; this plugin fails a production build whose output
 * contains it.
 *
 * @module
 */
import type { Plugin } from 'vite';

import { TIMING_PREFIX } from '../src/perf/targets.ts';

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

/** Fail a production build that contains timing instrumentation. */
export function noDevInstrumentation(marker = TIMING_PREFIX): Plugin {
  return {
    name: 'fooboard:no-dev-instrumentation',
    apply: (_config, env) =>
      env.command === 'build' && env.mode === 'production',
    generateBundle(_options, bundle) {
      const found = filesContaining(bundle, marker);
      if (found.length > 0)
        this.error(
          `Development timing instrumentation ("${marker}") found in the production bundle: ${found.join(', ')}`,
        );
    },
  };
}
