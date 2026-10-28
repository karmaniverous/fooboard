/**
 * Which scenario the demo plays (spec.md §3.14): the shipped one, or in a
 * development build the measurement scenario when the URL asks for it
 * (`?scenario=measure`). The measurement scenario is imported only on that
 * path, which a production build folds away, so its bundle never holds it
 * (the build checks: `vite/noDevInstrumentation.ts`).
 *
 * @module
 */
import { acmeScenario } from './scenarios/acme';
import type { DemoScenario } from './sim/scenario';

/** The URL's search parameter naming a development scenario. */
const SCENARIO_PARAM = 'scenario';
/** Its value for the measurement scenario. */
const MEASURE_SCENARIO = 'measure';

/** Module-local, so a production build folds it to `false` here. */
const DEV = import.meta.env.DEV;

let measuring: Promise<DemoScenario> | undefined;

/** Whether `search` asks for the measurement scenario. */
export const wantsMeasure = (search: string): boolean =>
  new URLSearchParams(search).get(SCENARIO_PARAM) === MEASURE_SCENARIO;

/** The scenario for a demo URL's `search`: the shipped one at once, or
 * the measurement scenario once loaded (one load per page). */
export function demoScenarioFor(
  search: string,
): DemoScenario | Promise<DemoScenario> {
  // `DEV &&` first, so a production build drops the import below.
  if (!(DEV && wantsMeasure(search))) return acmeScenario;
  measuring ??= import('./scenarios/measure').then((m) => m.measureScenario);
  return measuring;
}
