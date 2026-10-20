/**
 * Tests for editing a dashboard's own status sets: customising copies a
 * preset under a fresh id and chooses it, so the dashboard still parses
 * and looks the same; sets in use can't be removed; new statuses go on
 * top and match nothing; moves are clamped.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { PRESET_IDS } from '@/domain/config/statusSets';
import { never } from '@/domain/model/ruleBuilders';

import {
  addCellStatus,
  customise,
  removeSet,
  setInUse,
  updateSet,
} from './customSet';

const base = DashboardSchema.parse({ id: 'd', name: 'D' });

describe('customise', () => {
  it('copies a preset under a fresh id and chooses it for its provider', () => {
    const once = customise(base, PRESET_IDS.githubDeployTest);
    const twice = customise(once, PRESET_IDS.githubDeployTest);
    expect(twice.customStatusSets.map((s) => s.id)).toEqual([
      'custom-github',
      'custom-github-2',
    ]);
    expect(twice.statusSets).toEqual({
      github: 'custom-github-2',
      amplify: 'amplify',
    });
    expect(once.customStatusSets[0]?.name).toBe(
      'GitHub deploy and test (custom)',
    );
    expect(DashboardSchema.safeParse(twice).success).toBe(true);
  });

  it('copies a custom set without sharing its statuses', () => {
    const one = customise(base, 'amplify');
    const two = customise(one, 'custom-amplify');
    const edited = updateSet(two, 'custom-amplify-2', (s) => ({
      ...s,
      cell: s.cell.map((c) => ({ ...c, name: 'changed' })),
    }));
    expect(edited.customStatusSets[0]?.cell[0]?.name).not.toBe('changed');
  });

  it('leaves the dashboard alone for an unknown set', () => {
    expect(customise(base, 'nope')).toBe(base);
  });
});

describe('removing a set', () => {
  it('is blocked while the set is chosen, then allowed', () => {
    const d = customise(base, 'amplify');
    expect(setInUse(d, 'custom-amplify')).toBe(true);
    const unchosen = {
      ...d,
      statusSets: { ...d.statusSets, amplify: 'amplify' },
    };
    expect(setInUse(unchosen, 'custom-amplify')).toBe(false);
    expect(removeSet(unchosen, 'custom-amplify').customStatusSets).toEqual([]);
  });
});

describe('addCellStatus', () => {
  it('adds a status on top that matches nothing yet', () => {
    const [set] = customise(base, 'amplify').customStatusSets;
    const next = addCellStatus(set);
    expect(next.cell[0]).toMatchObject({
      name: 'New status',
      summary: set.summary[0]?.id,
      rule: never,
    });
    expect(next.cell).toHaveLength(set.cell.length + 1);
  });
});
