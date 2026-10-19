/**
 * Tests for status-set choices below the dashboard: each level sets and
 * clears its own choice, the dashboard still validates, and resolution
 * follows cell over row over row group over dashboard.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { branchRules } from '@/domain/config/placement';
import { PRESET_IDS } from '@/domain/config/statusSets';
import { inheritedStatusSetId, statusSetFor } from '@/domain/statuses/resolve';

import {
  setCellStatusSet,
  setGroupStatusSet,
  setRowStatusSet,
} from './overrideSets';

const base = DashboardSchema.parse({
  id: 'd',
  name: 'D',
  stages: [{ id: 'dev', name: 'dev', rules: branchRules('dev') }],
  rows: [{ type: 'github', id: 'web', repo: 'acme/web', displayName: 'web' }],
  rowGroups: [{ id: 'g', memberIds: ['web'] }],
});
const row = (d: typeof base) => d.rows[0];

describe('status-set overrides', () => {
  it('resolve cell over row over row group over dashboard, and clear', () => {
    let d = setGroupStatusSet(base, 'g', 'github', PRESET_IDS.githubSingleJob);
    expect(inheritedStatusSetId(d, row(d))).toBe(PRESET_IDS.githubSingleJob);
    expect(statusSetFor(d, row(d), 'dev').id).toBe(PRESET_IDS.githubSingleJob);
    d = setRowStatusSet(d, 'web', PRESET_IDS.githubDeployTest);
    expect(statusSetFor(d, row(d), 'dev').id).toBe(PRESET_IDS.githubDeployTest);
    d = setCellStatusSet(d, 'web', 'dev', PRESET_IDS.githubSingleJob);
    expect(statusSetFor(d, row(d), 'dev').id).toBe(PRESET_IDS.githubSingleJob);
    expect(DashboardSchema.safeParse(d).success).toBe(true);

    d = setCellStatusSet(d, 'web', 'dev', '');
    d = setRowStatusSet(d, 'web', '');
    d = setGroupStatusSet(d, 'g', 'github', '');
    expect(row(d).statusSet).toBeUndefined();
    expect(row(d).cellStatusSets).toEqual({});
    expect(d.rowGroups[0]?.statusSets).toEqual({});
    expect(statusSetFor(d, row(d), 'dev').id).toBe(PRESET_IDS.githubDeployTest);
  });
});
