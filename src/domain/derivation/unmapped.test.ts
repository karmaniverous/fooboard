/**
 * Tests for unmapped reasons: the order key, stage rules, row rules and
 * counted items in turn; a record placed by any row is not unmapped; and
 * without its items read, only stage and row rules decide.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { sourceFor } from '@/domain/config/cellRules';
import type { CellRules } from '@/domain/model/cell';
import { asJson } from '@/domain/model/json';
import { all, always, is } from '@/domain/model/ruleBuilders';
import { translate } from '@/domain/model/translate';
import { branchRule } from '@/domain/rules/branch';
import { presetById } from '@/domain/statuses/presets';

import { makeJob, makeRunWithJobs } from './testFixtures';
import { describeUnmappedReason, unmappedReason } from './unmapped';

const set = presetById('github-deploy-test');
const record = (headBranch: string, job: string) =>
  translate(
    sourceFor('github'),
    asJson(makeRunWithJobs({ headBranch }, [makeJob({ name: job })])),
  ).record;
const cell = (over: Partial<CellRules> = {}): CellRules => ({
  record: always,
  items: always,
  stage: branchRule('main'),
  set,
  order: 'created',
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
