/**
 * Tests for placement resolution: the most specific level wins on each
 * axis (row, row group, stage, column group, dashboard for stage rules;
 * row, row group, dashboard for row rules), per source; no stage rule
 * anywhere is `undefined`; `Object.prototype` names are never overrides.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { all, is } from '@/domain/model/ruleBuilders';
import { always } from '@/domain/rules/always';
import { branchRule } from '@/domain/rules/branch';

import { DashboardSchema } from './dashboard';
import { branchRules, rowRulesFor, stageRuleFor } from './placement';

const r = (p: string) => branchRule(p);
const d = DashboardSchema.parse({
  id: 'd',
  name: 'd',
  stageRules: { github: r('dash'), amplify: r('dash-a') },
  rowRules: { github: { record: all(is('$.workflow', 'CI')) } },
  stages: [
    { id: 'own', name: 'own', rules: branchRules('own') },
    { id: 'grouped', name: 'grouped' },
    { id: 'bare', name: 'bare' },
    { id: 'constructor', name: 'c', rules: branchRules('main') },
  ],
  columnGroups: [
    { id: 'cg', memberIds: ['grouped'], stageRules: { github: r('cg') } },
  ],
  rows: [
    {
      type: 'github',
      id: 'web',
      repo: 'a/web',
      displayName: 'web',
      stageRules: { own: r('row') },
      itemRule: all(is('$.name', 'x')),
    },
    {
      type: 'amplify',
      id: 'site',
      repo: 'a/site',
      displayName: 'site',
      sources: [{ region: 'us-east-1', appId: 'a1' }],
    },
    { type: 'github', id: 'api', repo: 'a/api', displayName: 'api' },
  ],
  rowGroups: [
    {
      id: 'g',
      memberIds: ['web', 'site'],
      stageRules: {
        own: { github: r('group') },
        grouped: { amplify: r('group-a') },
      },
      rowRules: { github: { items: all(is('$.name', 'g')) } },
    },
  ],
});
const row = (id: string) => {
  const found = d.rows.find((x) => x.id === id);
  if (!found) throw new Error(id);
  return found;
};

describe('stageRuleFor', () => {
  it.each([
    ['the row', 'web', 'own', r('row')],
    ['the row group', 'site', 'grouped', r('group-a')],
    ['the stage', 'api', 'own', r('own')],
    ['the column group', 'api', 'grouped', r('cg')],
    ['the dashboard', 'api', 'bare', r('dash')],
    ['the dashboard, per source', 'site', 'bare', r('dash-a')],
  ])('comes from %s', (_l, rowId, stageId, expected) => {
    expect(stageRuleFor(d, row(rowId), stageId)).toEqual(expected);
  });

  it('is undefined when no level sets one', () => {
    expect(
      stageRuleFor({ ...d, stageRules: {} }, row('api'), 'bare'),
    ).toBeUndefined();
  });

  it('ignores Object.prototype names as overrides (a stage called constructor)', () => {
    expect(stageRuleFor(d, row('api'), 'constructor')).toEqual(r('main'));
  });
});

describe('rowRulesFor', () => {
  it('takes the most specific record and item rules, else everything', () => {
    expect(rowRulesFor(d, row('web'))).toEqual({
      record: all(is('$.workflow', 'CI')),
      items: all(is('$.name', 'x')),
    });
    expect(rowRulesFor(d, row('api')).items).toEqual({
      combine: 'and',
      checks: [],
    });
    expect(rowRulesFor(d, row('site'))).toEqual({
      record: always,
      items: always,
    });
  });
});
