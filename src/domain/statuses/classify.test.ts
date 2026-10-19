/**
 * Tests for classification: the first status whose rule matches wins,
 * none matching gives `undefined`, and a rule that can't run matches
 * nothing instead of throwing.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import type { CellStatus } from '@/domain/config/statusSets';
import { all, always, check, is } from '@/domain/model/ruleBuilders';
import type { Rule } from '@/domain/rules/schema';

import { classify } from './classify';

const status = (id: string, rule: Rule): CellStatus => ({
  id,
  name: id,
  color: '#000000',
  summary: 's',
  outlined: false,
  rule,
});
const failed = all(is('$.status', 'FAILED'));

describe('classify', () => {
  it('returns the first status whose rule matches', () => {
    const set = { cell: [status('a', failed), status('b', always)] };
    expect(classify({ status: 'FAILED' }, set)?.id).toBe('a');
    expect(classify({ status: 'OK' }, set)?.id).toBe('b');
    expect(
      classify({ status: 'OK' }, { cell: [status('a', failed)] }),
    ).toBeUndefined();
  });

  it('treats a rule that cannot run as matching nothing', () => {
    const bad = status(
      'bad',
      all(check({ path: '$.status', operator: 'regex', value: '(' })),
    );
    expect(
      classify({ status: 'x' }, { cell: [bad, status('ok', always)] })?.id,
    ).toBe('ok');
  });
});
