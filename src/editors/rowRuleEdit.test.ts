/**
 * Tests for row-rule editing: set and unset a group's or the dashboard's
 * record rule per source, dropping a source with none.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { all, is } from '@/domain/model/ruleBuilders';

import { setDashboardRowRule, setGroupRowRule } from './rowRuleEdit';

const d = DashboardSchema.parse({
  id: 'd',
  name: 'd',
  rows: [
    { type: 'github', id: 'web', repo: 'a/web', displayName: 'web' },
    { type: 'github', id: 'api', repo: 'a/api', displayName: 'api' },
  ],
  rowGroups: [
    { id: 'g', memberIds: ['web'] },
    { id: 'h', memberIds: ['api'] },
  ],
});
const rule = all(is('$.workflow', 'CI'));

describe('row rule editing', () => {
  it("sets and unsets a group's record rule per source", () => {
    const set = setGroupRowRule(d, 'g', 'github', rule);
    expect(set.rowGroups[0]?.rowRules.github).toEqual({ record: rule });
    expect(set.rowGroups[0]?.rowRules.amplify).toBeUndefined();
    expect(set.rowGroups[1]).toBe(d.rowGroups[1]);
    const back = setGroupRowRule(set, 'g', 'github', undefined);
    expect(back.rowGroups[0]?.rowRules.github).toBeUndefined();
  });

  it("sets and unsets the dashboard's", () => {
    const set = setDashboardRowRule(d, 'amplify', rule);
    expect(set.rowRules.amplify).toEqual({ record: rule });
    expect(
      setDashboardRowRule(set, 'amplify', undefined).rowRules.amplify,
    ).toBeUndefined();
  });
});
