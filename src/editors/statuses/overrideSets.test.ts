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
    let d = setGroupStatusSet(base, 'g', 'github', 'github-single-job');
    expect(inheritedStatusSetId(d, row(d))).toBe('github-single-job');
    expect(statusSetFor(d, row(d), 'dev').id).toBe('github-single-job');
    d = setRowStatusSet(d, 'web', 'github-deploy-test');
    expect(statusSetFor(d, row(d), 'dev').id).toBe('github-deploy-test');
    d = setCellStatusSet(d, 'web', 'dev', 'github-single-job');
    expect(statusSetFor(d, row(d), 'dev').id).toBe('github-single-job');
    expect(DashboardSchema.safeParse(d).success).toBe(true);

    d = setCellStatusSet(d, 'web', 'dev', '');
    d = setRowStatusSet(d, 'web', '');
    d = setGroupStatusSet(d, 'g', 'github', '');
    expect(row(d).statusSet).toBeUndefined();
    expect(row(d).cellStatusSets).toEqual({});
    expect(d.rowGroups[0]?.statusSets).toEqual({});
    expect(statusSetFor(d, row(d), 'dev').id).toBe('github-deploy-test');
  });
});
