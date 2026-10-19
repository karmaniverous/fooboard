/**
 * Tests for row-rule editing: set and unset a group's or the dashboard's
 * record and item rules per source, dropping a source with neither.
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
  rows: [{ type: 'github', id: 'web', repo: 'a/web', displayName: 'web' }],
  rowGroups: [{ id: 'g', memberIds: ['web'] }],
});
const rule = all(is('$.workflow', 'CI'));

describe('row rule editing', () => {
  it("sets and unsets a group's rules per source", () => {
    const set = setGroupRowRule(d, 'g', 'github', 'record', rule);
    expect(set.rowGroups[0]?.rowRules.github).toEqual({ record: rule });
    const both = setGroupRowRule(set, 'g', 'github', 'items', rule);
    expect(both.rowGroups[0]?.rowRules.github).toEqual({
      record: rule,
      items: rule,
    });
    const back = setGroupRowRule(
      setGroupRowRule(both, 'g', 'github', 'record', undefined),
      'g',
      'github',
      'items',
      undefined,
    );
    expect(back.rowGroups[0]?.rowRules.github).toBeUndefined();
  });

  it("sets the dashboard's", () => {
    expect(
      setDashboardRowRule(d, 'amplify', 'record', rule).rowRules.amplify,
    ).toEqual({ record: rule });
  });
});
