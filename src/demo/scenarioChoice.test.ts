/**
 * The demo's scenario (spec.md §3.14): the shipped one at once, or in a
 * development build the measurement scenario when the URL asks for it,
 * loaded once per page.
 */
import { describe, expect, it } from 'vitest';

import { demoScenarioFor, wantsMeasure } from './scenarioChoice';
import { acmeScenario } from './scenarios/acme';
import { measureScenario } from './scenarios/measure';

describe('demo scenario choice', () => {
  it('reads ?scenario=measure', () => {
    expect(wantsMeasure('?scenario=measure')).toBe(true);
    expect(wantsMeasure('?latency=300&scenario=measure')).toBe(true);
    expect(wantsMeasure('?scenario=acme')).toBe(false);
    expect(wantsMeasure('')).toBe(false);
  });

  it('plays the shipped scenario at once, the measurement one once loaded', async () => {
    expect(demoScenarioFor('')).toBe(acmeScenario);
    expect(demoScenarioFor('?scenario=other')).toBe(acmeScenario);
    const loading = demoScenarioFor('?scenario=measure');
    expect(loading).toBeInstanceOf(Promise);
    expect(demoScenarioFor('?scenario=measure')).toBe(loading);
    expect(await loading).toBe(measureScenario);
  });
});
