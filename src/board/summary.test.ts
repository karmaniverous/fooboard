/**
 * Tests for the summary chips and filters (C-14a, A§4.3.6): one chip per
 * summary status the cells show, Unknown last, then behind and diverged;
 * a filter matches a cell by its summary status or badge.
 *
 * @module
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { githubSet } from '@/domain/derivation/testFixtures';
import {
  type ResolvedStatus,
  resolveStatus,
  UNKNOWN,
} from '@/domain/statuses/resolved';
import type { BoardCell, BoardModel } from '@/engine';

import { matchesFilter, summarize, useCellFilter } from './summary';

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
  settled: true,
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
      settled: true,
    },
  },
  unmapped: [],
  problems: [],
  amplifyBranches: [],
  amplifyKeyApps: {},
  budgets: {},
  refreshedAt: {},
};

describe('summarize', () => {
  it('counts each summary status the cells show, in set order, Unknown last, then badges', () => {
    expect(summarize(model).map((c) => [c.name, c.count])).toEqual([
      ['Failing', 2],
      ['Running', 1],
      ['Unknown', 1],
      ['behind', 1],
      ['diverged', 1],
    ]);
    expect(summarize(model)[0]).toMatchObject({
      name: 'Failing',
      color: '#dc2626',
    });
  });

  it('keeps a renamed summary status apart from the preset sharing its id, and merges equal ones', () => {
    const failing = status('testFailed');
    const renamed = {
      ...failing,
      summary: { ...failing.summary, name: 'Broken' },
    };
    const samePresentation = { ...failing, summary: { ...failing.summary } };
    const chips = summarize({
      ...model,
      cells: { a: cell(failing), b: cell(renamed), c: cell(samePresentation) },
    });
    expect(chips.slice(0, 2).map((c) => [c.name, c.count])).toEqual([
      ['Failing', 2],
      ['Broken', 1],
    ]);
  });

  it("doesn't let a summary status called behind pass for the badge", () => {
    const failing = status('testFailed');
    const behind = {
      ...failing,
      summary: { ...failing.summary, id: 'behind', name: 'behind' },
    };
    const chips = summarize({ ...model, cells: { a: cell(behind) } });
    const badge = chips.find((c) => c.badge === 'behind');
    const own = chips.find((c) => c.name === 'behind' && !c.badge);
    expect(badge?.count).toBe(0);
    expect(own?.count).toBe(1);
    expect(own?.id).not.toBe(badge?.id);
  });

  it('counts a provisional cell toward no chip and matches it to no filter', () => {
    const provisional = cell(status('testFailed'), {
      provisional: 'status',
      settled: false,
      badge: { kind: 'behind', count: 1 },
    });
    const chips = summarize({ ...model, cells: { a: provisional } });
    expect(chips.every((c) => c.count === 0)).toBe(true);
    for (const chip of summarize(model))
      expect(matchesFilter(provisional, chip.id)).toBe(false);
  });
});

describe('matchesFilter', () => {
  const [failing, running, , behind] = summarize(model).map((c) => c.id);
  it('matches by summary status or badge, never an empty cell', () => {
    expect(matchesFilter(model.cells.b, failing)).toBe(true);
    expect(matchesFilter(model.cells.b, running)).toBe(false);
    expect(matchesFilter(model.cells.c, behind)).toBe(true);
    expect(matchesFilter(model.cells.e, failing)).toBe(false);
    expect(matchesFilter(undefined, failing)).toBe(false);
  });
});

describe('useCellFilter', () => {
  it('clears the filter when its chip goes, keeping it while it shows', () => {
    const failingOnly: BoardModel = { ...model, cells: { b: model.cells.b } };
    const { result, rerender } = renderHook(
      ({ m }: { m: BoardModel }) => useCellFilter(m),
      { initialProps: { m: failingOnly } },
    );
    const [failing] = summarize(failingOnly).map((c) => c.id);
    act(() => {
      result.current[1](failing);
    });
    rerender({ m: model });
    expect(result.current[0]).toBe(failing);
    // The last failing cell recovers: the chip goes, and so does the filter.
    rerender({ m: { ...model, cells: { d: model.cells.d } } });
    expect(result.current[0]).toBeNull();
  });
});
