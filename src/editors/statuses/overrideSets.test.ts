/**
 * Tests for choosing status sets: each of the six levels chooses a set
 * (the dashboard still validates), resolution follows the lattice, and
 * swapping a set reaches every choice of it, the built-in's use included.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import { PRESET_IDS } from '@/domain/config/statusSets';
import type { SettingsPlace } from '@/domain/settings/places';
import { statusSetFor } from '@/domain/statuses/resolve';

import { chooseSetAt, replaceSet } from './overrideSets';

const base = DashboardSchema.parse({
  id: 'd',
  name: 'D',
  stages: [{ id: 'dev', name: 'dev', rules: branchRules('dev') }],
  rows: [{ type: 'github', id: 'web', repo: 'acme/web', displayName: 'web' }],
  rowGroups: [{ id: 'g', memberIds: ['web'] }],
  columnGroups: [{ id: 'c', memberIds: ['dev'] }],
});
const row = (d: typeof base) => d.rows[0];
const SINGLE = PRESET_IDS.githubSingleJob;
const DEPLOY = PRESET_IDS.githubDeployTest;

describe('choosing status sets', () => {
  it.each<[string, SettingsPlace]>([
    ['the dashboard', { level: 'dashboard' }],
    ['a row group', { level: 'rowGroup', groupId: 'g' }],
    ['a column group', { level: 'columnGroup', groupId: 'c' }],
    ['a row', { level: 'row', rowId: 'web' }],
    ['a column', { level: 'column', stageId: 'dev' }],
    ['a cell', { level: 'cell', rowId: 'web', stageId: 'dev' }],
  ])('chooses a set at %s, which the cell uses', (_label, place) => {
    const d = chooseSetAt(base, place, 'github', SINGLE);
    expect(DashboardSchema.safeParse(d).success).toBe(true);
    expect(statusSetFor(d, row(d), 'dev').id).toBe(SINGLE);
  });

  it('swaps every choice of a set, and its built-in use', () => {
    const chosen = chooseSetAt(
      chooseSetAt(base, { level: 'row', rowId: 'web' }, 'github', SINGLE),
      { level: 'cell', rowId: 'web', stageId: 'dev' },
      'github',
      SINGLE,
    );
    const swapped = replaceSet(chosen, 'github', SINGLE, 'mine');
    expect(row(swapped).settings.statusSets).toEqual({ github: 'mine' });
    expect(row(swapped).cellSettings.dev.statusSets).toEqual({
      github: 'mine',
    });
    // The dashboard chose none, but the built-in is not the swapped set.
    expect(swapped.settings.statusSets).toBeUndefined();
    expect(
      replaceSet(base, 'github', DEPLOY, 'mine').settings.statusSets,
    ).toEqual({ github: 'mine' });
    // Another source's choice of the same id is left alone.
    expect(
      replaceSet(base, 'amplify', DEPLOY, 'mine').settings.statusSets,
    ).toBeUndefined();
  });
});
