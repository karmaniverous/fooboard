/**
 * The measurement scenario's marker (spec.md §3.14 *Measurement
 * scenario*): the id of its EU partner app, found in no other scenario,
 * so a production bundle that contains it fails the build
 * (`vite/noDevInstrumentation.ts`). Kept free of imports, so the build's
 * config can read it.
 *
 * @module
 */

/** The EU partner app's id in the measurement scenario. */
export const MEASURE_SCENARIO_MARKER = 'd1demopartnereu';
