/**
 * Tests for window hints (spec.md A§4.3.7, §3.12 *Reads deduped*; spec
 * 0.2.0 §3.B): a full read hints only the *No records* cells it serves (an
 * app's or a token's columns), and nothing when it wasn't full; whether a
 * cell's read was full is asked per cell; and an Amplify cell whose stage
 * rule is a branch pattern counts as full only through a matching branch
 * whose own read was full.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { measureBoard } from '@/demo/scenarios/measure';
import { EMPTY_STATES } from '@/domain/derivation';
import { sourceRuleFor } from '@/domain/model/sources';
import { branchRule } from '@/domain/rules/branch';

import { amplifyCellFull, fullReadHints, servedBy } from './windowHints';

const empty = {
  derivation: {
    kind: 'empty',
    state: EMPTY_STATES.noRecords,
  },
} as const;
const cells = () => ({ dev: empty, prod: empty });
const source = sourceRuleFor(measureBoard, 'amplify');
const full = () => true;

describe('fullReadHints', () => {
  it('hints only the empty cells the full read serves', () => {
    const hints = fullReadHints(
      full,
      servedBy([{ row: { id: 'site' }, stageIds: ['prod'] }]),
      cells,
      source,
    );
    expect(hints).toHaveLength(1);
    expect(hints[0]?.level).toMatchObject({ stageId: 'prod' });
    expect(
      fullReadHints(
        full,
        [{ rowId: 'site', stageIds: ['dev', 'prod'] }],
        cells,
        source,
      ),
    ).toHaveLength(2);
  });

  it('hints nothing when the read was not full', () => {
    expect(
      fullReadHints(
        () => false,
        [{ rowId: 'site', stageIds: ['prod'] }],
        cells,
        source,
      ),
    ).toEqual([]);
  });

  it('asks per cell whether its read was full', () => {
    const hints = fullReadHints(
      (_rowId, stageId) => stageId === 'dev',
      [{ rowId: 'site', stageIds: ['dev', 'prod'] }],
      cells,
      source,
    );
    expect(hints.map((h) => h.level)).toEqual([
      expect.objectContaining({ stageId: 'dev' }),
    ]);
  });
});

describe('amplifyCellFull', () => {
  const read = {
    full: true,
    readBranches: [
      { name: 'main', full: true },
      { name: 'release/1', full: false },
      { name: 'release/2', full: true },
    ],
  };

  it('is full through a matching branch read full', () => {
    expect(amplifyCellFull(read, branchRule('main'), false)).toBe(true);
    expect(amplifyCellFull(read, branchRule('release/*'), false)).toBe(true);
  });

  it('is not full when every matching branch was read short', () => {
    expect(amplifyCellFull(read, branchRule('release/1'), false)).toBe(false);
  });

  it('is not full when its pattern matches no branch read', () => {
    expect(amplifyCellFull(read, branchRule('dev'), false)).toBe(false);
  });

  it('follows the app-wide read without a branch pattern or when judged app-wide', () => {
    const negated = branchRule('release/1');
    const notPattern = {
      ...negated,
      checks: negated.checks.map((c) => ({ ...c, not: true })),
    };
    for (const [rule, appWide] of [
      [notPattern, false],
      [undefined, false],
      [branchRule('release/1'), true],
    ] as const) {
      expect(amplifyCellFull(read, rule, appWide)).toBe(true);
      expect(amplifyCellFull({ ...read, full: false }, rule, appWide)).toBe(
        false,
      );
    }
  });
});
