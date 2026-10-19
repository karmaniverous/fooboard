/**
 * Tests for translation and placement: keys from translations, catch-alls
 * and copies (with their problems); items and `_raw`; the order key;
 * record, stage and item rules; counted items only in what status rules
 * see; time and link from the latest counted item.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { BUILTIN_SETS } from './builtinSets';
import { type CellRules, placeCell } from './cell';
import { all, always, copy, give, is } from './ruleBuilders';
import { SourceRuleSchema } from './sourceRule';
import { compareOrder, translate } from './translate';

const rule = SourceRuleSchema.parse({
  id: 's',
  name: 'S',
  provider: 'github',
  keys: [
    {
      name: 'kind',
      translations: [
        give('big', all(is('$.size', 'L'))),
        give('small', all(is('$.size', 'S'))),
      ],
    },
    { name: 'tags', translations: [copy('$.tags[*]')] },
    { name: 'n', translations: [copy('$.n')] },
  ],
  items: {
    path: '$.parts[*]',
    keys: [
      { name: 'name', translations: [copy('$.name')] },
      { name: 'time', translations: [copy('$.at'), give('')] },
      { name: 'link', translations: [copy('$.url')] },
    ],
  },
  order: 'n',
});

describe('translate', () => {
  it('translates keys and items, keeps the raw data, and reports misses', () => {
    const raw = {
      size: 'M',
      tags: ['a', 'b'],
      n: 3,
      parts: [{ name: 'x', url: 'u' }],
    };
    const { record, problems } = translate(rule, raw);
    expect(record).toEqual({
      kind: null,
      tags: 'a',
      n: 3,
      items: [{ name: 'x', time: '', link: 'u' }],
      _raw: raw,
    });
    expect(problems.map((p) => [p.key, p.scope, p.kind])).toEqual([
      ['kind', 'record', 'untranslated'],
      ['tags', 'record', 'multiple-values'],
    ]);
  });

  it('orders numbers as numbers and anything else as text, null first', () => {
    expect(compareOrder(9, 10)).toBeLessThan(0);
    expect(compareOrder('2026-10-02', '2026-10-10')).toBeLessThan(0);
    expect(compareOrder(null, 'a')).toBeLessThan(0);
    expect(compareOrder('a', 'a')).toBe(0);
  });
});

describe('placeCell', () => {
  const doc = (
    n: number | null,
    parts: { name: string; at?: string; url: string }[],
    size = 'L',
  ) => translate(rule, { size, n, parts }).record;
  const set = {
    ...BUILTIN_SETS[0],
    id: 't',
    items: all(is('$.name', 'keep*')),
    cell: [
      {
        id: 'big',
        name: 'Big',
        color: '#000000',
        summary: 'ok',
        outlined: false,
        rule: all(is('$.kind', 'big'), is('$.items[*].name', 'keep-2')),
      },
    ],
  };
  const rules = (over: Partial<CellRules> = {}): CellRules => ({
    record: always,
    items: always,
    stage: always,
    set,
    order: 'n',
    ...over,
  });

  it('shows the last record by the order key that passes every rule', () => {
    const records = [
      doc(1, [{ name: 'keep-1', url: 'a' }]),
      doc(3, [{ name: 'drop', url: 'b' }]),
      doc(2, [{ name: 'keep-2', url: 'c' }]),
      doc(null, [{ name: 'keep-9', url: 'd' }]),
    ];
    expect(placeCell(records, rules())?.record.n).toBe(2);
    expect(placeCell(records, rules({ stage: undefined }))).toBeUndefined();
    expect(
      placeCell(records, rules({ record: all(is('$.n', '1')) }))?.record.n,
    ).toBe(1);
    expect(
      placeCell(records, rules({ items: all(is('$.name', '*-1')) }))?.record.n,
    ).toBe(1);
  });

  it('classifies with only counted items, Unknown when nothing matches', () => {
    const both = doc(1, [
      { name: 'keep-2', url: 'a' },
      { name: 'drop', url: 'b' },
    ]);
    expect(placeCell([both], rules())?.status?.id).toBe('big');
    expect(placeCell([both], rules())?.record.items).toEqual([
      { name: 'keep-2', time: '', link: 'a' },
    ]);
    expect(
      placeCell([doc(1, [{ name: 'keep-1', url: 'a' }])], rules())?.status,
    ).toBeUndefined();
  });

  it('takes time and link from the counted item with the latest time, else the record', () => {
    const placed = placeCell(
      [
        doc(1, [
          { name: 'keep-a', at: '2026-10-19T02:00:00Z', url: 'late' },
          { name: 'keep-b', at: '2026-10-19T01:00:00Z', url: 'early' },
          { name: 'keep-c', url: 'none' },
        ]),
      ],
      rules(),
    );
    expect([placed?.time, placed?.link]).toEqual([
      '2026-10-19T02:00:00Z',
      'late',
    ]);
    const itemless = SourceRuleSchema.parse({
      id: 'a',
      name: 'A',
      provider: 'amplify',
      keys: [
        { name: 'n', translations: [give('1')] },
        { name: 'time', translations: [give('t')] },
        { name: 'link', translations: [give('l')] },
      ],
      order: 'n',
    });
    const placedItemless = placeCell(
      [translate(itemless, {}).record],
      rules({ set: { ...set, items: always } }),
    );
    expect([placedItemless?.time, placedItemless?.link]).toEqual(['t', 'l']);
  });
});
