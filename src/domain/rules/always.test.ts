import { all, is } from '@/domain/model/ruleBuilders';

import { always, isAlways, unlessAlways } from './always';
import { evaluateRule } from './check';

describe('always', () => {
  it('matches every document', () => {
    expect(evaluateRule(always, null)).toBe(true);
    expect(evaluateRule(always, { branch: 'main' })).toBe(true);
  });

  it('is the rule with no checks, whichever way it joins them', () => {
    expect(isAlways(always)).toBe(true);
    expect(isAlways({ combine: 'or', checks: [] })).toBe(true);
    expect(isAlways(all(is('$.branch', 'main')))).toBe(false);
  });

  it('unsets an emptied rule and keeps one with checks', () => {
    const rule = all(is('$.branch', 'main'));
    expect(unlessAlways(undefined)).toBeUndefined();
    expect(unlessAlways(always)).toBeUndefined();
    expect(unlessAlways({ combine: 'or', checks: [] })).toBeUndefined();
    expect(unlessAlways(rule)).toBe(rule);
  });
});
