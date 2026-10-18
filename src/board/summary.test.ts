/**
 * Tests for the summary chips and filters (C-14a, A§4.3.6): one chip per
 * summary status the cells show, Unknown last, then behind and diverged;
 * a filter matches a cell by its summary status or badge.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { githubSet } from '@/domain/derivation/testFixtures';
import {
  type ResolvedStatus,
  resolveStatus,
  UNKNOWN,
} from '@/domain/statuses/resolved';
import type { BoardCell, BoardModel } from '@/engine';

import { matchesFilter, summarize } from './summary';

const status = (id: string): ResolvedStatus =>
  resolveStatus(
    githubSet,
    githubSet.cell.find((c) => c.id === id),
  );

const cell = (
  s: ResolvedStatus,
  extra: Partial<BoardCell> = {},
): BoardCell => ({
  rowId: 'r',
  stageId: 's',
  derivation: {
    kind: 'ok',
    status: s,
    branch: 'main',
    commit: 'abc',
    time: undefined,
    linkUrl: '',
    document: {
      workflow: 'CI',
      event: 'push',
      branch: 'main',
      attempt: 1,
      jobs: [],
    },
  },
  active: false,
  badge: undefined,
  ...extra,
});

const model: BoardModel = {
  cells: {
    a: cell(UNKNOWN),
    b: cell(status('testFailed')),
    c: cell(status('deployFailed'), { badge: { kind: 'behind', count: 2 } }),
    d: cell(status('deploying'), {
      badge: { kind: 'diverged', behind: 1, ahead: 1 },
    }),
    e: {
      rowId: 'r',
      stageId: 's',
      derivation: { kind: 'empty', state: 'error' },
      active: false,
      badge: undefined,
    },
  },
  unmapped: [],
  budgets: {},
  refreshedAt: {},
};

describe('summarize', () => {
  it('counts each summary status the cells show, in set order, Unknown last, then badges', () => {
    expect(summarize(model).map((c) => [c.id, c.count])).toEqual([
      ['failing', 2],
      ['running', 1],
      ['unknown', 1],
      ['behind', 1],
      ['diverged', 1],
    ]);
    expect(summarize(model)[0]).toMatchObject({
      name: 'Failing',
      color: '#dc2626',
    });
  });
});

describe('matchesFilter', () => {
  it('matches by summary status or badge, never an empty cell', () => {
    expect(matchesFilter(model.cells.b, 'failing')).toBe(true);
    expect(matchesFilter(model.cells.b, 'running')).toBe(false);
    expect(matchesFilter(model.cells.c, 'behind')).toBe(true);
    expect(matchesFilter(model.cells.e, 'failing')).toBe(false);
    expect(matchesFilter(undefined, 'failing')).toBe(false);
  });
});
