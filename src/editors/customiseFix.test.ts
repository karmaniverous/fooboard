/**
 * Tests for *Customise* from a problem: offered for a problem in a
 * built-in source rule or preset, it copies the built-in, uses the copy
 * wherever the built-in was used, and opens the editor on it; never for a
 * dashboard's own rule.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { PRESET_IDS } from '@/domain/config/statusSets';
import { problem } from '@/domain/problems/problem';

import { customiseFor, offersCustomise } from './customiseFix';

const dashboard = DashboardSchema.parse({
  id: 'd',
  name: 'd',
  rows: [
    {
      type: 'github',
      id: 'web',
      repo: 'a/web',
      displayName: 'web',
      statusSet: PRESET_IDS.githubDeployTest,
    },
  ],
  rowGroups: [
    {
      id: 'g',
      memberIds: ['web'],
      statusSets: { github: PRESET_IDS.githubDeployTest },
    },
  ],
});
const inSource = problem({ kind: 'dashboard' }, 'x', false, {
  target: { kind: 'source', provider: 'github', key: 'state' },
});
const inPreset = problem(
  { kind: 'statusSet', id: PRESET_IDS.githubDeployTest },
  'y',
);

describe('customiseFor', () => {
  it('copies a built-in source rule and opens the editor on it', () => {
    expect(offersCustomise(dashboard, inSource)).toBe(true);
    const fix = customiseFor(dashboard, inSource);
    const copy = fix?.dashboard.customSourceRules[0];
    expect(copy?.provider).toBe('github');
    expect(fix?.dashboard.sourceRules.github).toBe(copy?.id);
    expect(fix?.draft).toEqual({
      tab: 'Sources',
      focus: [
        'source:github:key:state',
        'source:github',
        'source-choice:github',
      ],
    });
    if (!fix) throw new Error('no fix');
    expect(offersCustomise(fix.dashboard, inSource)).toBe(false);
  });

  it('copies a preset and uses the copy wherever the preset was chosen', () => {
    const fix = customiseFor(dashboard, inPreset);
    const copy = fix?.dashboard.customStatusSets[0];
    expect(copy?.id).toEqual(expect.any(String));
    expect(copy?.id).not.toBe(PRESET_IDS.githubDeployTest);
    expect(fix?.dashboard.statusSets.github).toBe(copy?.id);
    expect(fix?.dashboard.rowGroups[0]?.statusSets.github).toBe(copy?.id);
    expect(fix?.dashboard.rows[0]?.statusSet).toBe(copy?.id);
    expect(fix?.draft.focus?.[0]).toBe(`statusSet:${copy?.id ?? ''}`);
  });

  it('offers nothing for a problem in no built-in', () => {
    const elsewhere = problem({ kind: 'stage', id: 'dev' }, 'z');
    expect(offersCustomise(dashboard, elsewhere)).toBe(false);
    expect(customiseFor(dashboard, elsewhere)).toBeUndefined();
  });
});
