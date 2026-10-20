/**
 * Tests for source-rule editing: Customise copies and chooses (with a
 * fresh id each time), edits replace only their rule, and a rule in use
 * can't be removed.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';

import {
  chooseSource,
  customiseSource,
  removeSource,
  sourceInUse,
  updateSource,
} from './customSource';

const base = DashboardSchema.parse({ id: 'd', name: 'd' });

describe('customSource', () => {
  it('copies a built-in into the dashboard and chooses the copy', () => {
    const once = customiseSource(base, 'github');
    const twice = customiseSource(once, 'github');
    expect(twice.customSourceRules.map((s) => [s.id, s.name])).toEqual([
      ['custom-github', 'GitHub (custom)'],
      ['custom-github-2', 'GitHub (custom)'],
    ]);
    expect(twice.sourceRules).toEqual({
      github: 'custom-github-2',
      amplify: 'amplify',
    });
    expect(customiseSource(base, 'nope')).toBe(base);
  });

  it('edits and removes only a rule not in use', () => {
    const d = customiseSource(base, 'amplify');
    const [copy] = d.customSourceRules;
    const renamed = updateSource(d, { ...copy, name: 'Renamed' });
    expect(renamed.customSourceRules[0]?.name).toBe('Renamed');
    expect(sourceInUse(renamed, copy.id)).toBe(true);
    const back = chooseSource(renamed, 'amplify', 'amplify');
    expect(sourceInUse(back, copy.id)).toBe(false);
    expect(removeSource(back, copy.id).customSourceRules).toEqual([]);
  });
});
