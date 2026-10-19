/**
 * Tests for unmapped reasons: the order key, stage rules, row rules and
 * counted items in turn; a record placed by any row is not unmapped; and
 * without its items read, only stage and row rules decide.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { DashboardSchema } from '@/domain/config/dashboard';
import { BUILTIN_ORDER_KEYS } from '@/domain/model/builtinSources';
import type { CellRules } from '@/domain/model/cell';
import { asJson } from '@/domain/model/json';
import { all, is } from '@/domain/model/ruleBuilders';
import { sourceRuleFor } from '@/domain/model/sources';
import { translate } from '@/domain/model/translate';
import { always } from '@/domain/rules/always';
import { branchRule } from '@/domain/rules/branch';
import { presetById } from '@/domain/statuses/presets';

import { makeJob, makeRunWithJobs } from './testFixtures';
import { describeUnmappedReason, rowReasons, unmappedReason } from './unmapped';

const set = presetById('github-deploy-test');
const record = (headBranch: string, job: string) =>
  translate(
    sourceRuleFor(DashboardSchema.parse({ id: 'd', name: 'd' }), 'github'),
    asJson(makeRunWithJobs({ headBranch }, [makeJob({ name: job })])),
  ).record;
const cell = (over: Partial<CellRules> = {}): CellRules => ({
  record: always,
  items: always,
  stage: branchRule('main'),
  set,
  order: BUILTIN_ORDER_KEYS.github,
  ...over,
});

describe('unmappedReason', () => {
  it.each([
    [
      'no stage rule matches',
      record('feature/x', 'deploy'),
      [cell()],
      { kind: 'no-stage-matches', branch: 'feature/x' },
    ],
    [
      'no stage rule at all',
      record('main', 'deploy'),
      [cell({ stage: undefined })],
      { kind: 'no-stage-matches', branch: 'main' },
    ],
    [
      'no row rule matches',
      record('main', 'deploy'),
      [cell({ record: all(is('$.workflow', 'Nope')) })],
      { kind: 'no-row-matches' },
    ],
    [
      'no item counts',
      record('main', 'lint'),
      [cell()],
      { kind: 'no-item-counts' },
    ],
    [
      'no item the row takes',
      record('main', 'deploy (billing)'),
      [cell({ items: all(is('$.name', '*invoicing*')) })],
      { kind: 'no-item-counts' },
    ],
    ['placed', record('main', 'deploy'), [cell()], undefined],
    [
      'placed by one of several rows',
      record('main', 'deploy'),
      [cell({ stage: branchRule('dev') }), cell()],
      undefined,
    ],
  ])('%s', (_label, r, cells, expected) => {
    expect(unmappedReason(r, cells, true)).toEqual(expected);
  });

  it('reports a record without its order key', () => {
    expect(
      unmappedReason(
        { ...record('main', 'deploy'), created: null },
        [cell()],
        true,
      ),
    ).toEqual({ kind: 'no-order-key' });
  });

  it('leaves items undecided when they were not read', () => {
    expect(
      unmappedReason(record('main', 'lint'), [cell()], false),
    ).toBeUndefined();
  });
});

describe('rowReasons', () => {
  const missed = record('feature/x', 'deploy');
  const placedOnB = [
    { rowId: 'a', cells: [cell()] },
    { rowId: 'b', cells: [cell({ stage: branchRule('feature/x') })] },
  ];

  it('gives every row its reason when none places the record', () => {
    expect(
      rowReasons(
        missed,
        [
          { rowId: 'a', cells: [cell()] },
          { rowId: 'b', cells: [cell({ record: all(is('$.workflow', 'x')) })] },
        ],
        true,
      ),
    ).toEqual([
      { rowId: 'a', reason: { kind: 'no-stage-matches', branch: 'feature/x' } },
      { rowId: 'b', reason: { kind: 'no-stage-matches', branch: 'feature/x' } },
    ]);
  });

  it('is undefined when any row places the record', () => {
    expect(rowReasons(missed, placedOnB, true)).toBeUndefined();
  });

  it('is undefined when no row reads the record', () => {
    expect(rowReasons(missed, [], true)).toBeUndefined();
  });
});

describe('describeUnmappedReason', () => {
  it('renders each reason as the C-15 message text', () => {
    expect(
      describeUnmappedReason({ kind: 'no-stage-matches', branch: 'feature/x' }),
    ).toBe('no stage rule matches branch "feature/x"');
    expect(describeUnmappedReason({ kind: 'no-stage-matches' })).toBe(
      'no stage rule matches',
    );
    expect(describeUnmappedReason({ kind: 'no-row-matches' })).toBe(
      'no row rule matches',
    );
    expect(describeUnmappedReason({ kind: 'no-item-counts' })).toBe(
      'no item counts',
    );
    expect(describeUnmappedReason({ kind: 'no-order-key' })).toBe(
      'no order key',
    );
  });
});
