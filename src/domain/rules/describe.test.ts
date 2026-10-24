/**
 * Tests for a rule in words: each check's operator and NOT, the rule's
 * AND or OR, and what an empty rule matches.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { always } from './always';
import { describeCheck, describeRule } from './describe';
import { RuleSchema } from './schema';

describe('describeRule', () => {
  it('words each check', () => {
    const [glob, exists] = RuleSchema.parse({
      checks: [
        { path: '$.name', value: 'deploy*' },
        { path: '$.tag', operator: 'exists', not: true },
      ],
    }).checks;
    expect(describeCheck(glob)).toBe('$.name matches deploy*');
    expect(describeCheck(exists)).toBe('NOT $.tag exists');
  });

  it("joins checks with the rule's AND or OR, and names an empty rule", () => {
    const checks = [
      { path: '$.a', value: 'x' },
      { path: '$.b', value: 'y' },
    ];
    expect(describeRule(RuleSchema.parse({ checks }), 'all')).toBe(
      '$.a matches x and $.b matches y',
    );
    expect(
      describeRule(RuleSchema.parse({ combine: 'or', checks }), 'all'),
    ).toBe('$.a matches x or $.b matches y');
    expect(describeRule(always, 'every item')).toBe('every item');
  });
});
