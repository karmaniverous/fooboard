/**
 * Tests for the summary counts and filters: failing is a failure result,
 * running follows the cell's active flag (not its colour), and behind and
 * diverged are counted separately.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import type { BoardCell, BoardModel } from '@/engine';

import { summarize } from './summary';

const ok = (status: 'failure' | 'success' | 'partialSuccess') => ({
  kind: 'ok' as const,
  status,
  phase: 'deploy' as const,
  branch: 'main',
  commit: 'abc',
  time: undefined,
  linkUrl: '',
});

const cell = (extra: Partial<BoardCell>): BoardCell => ({
  rowId: 'r',
  stageId: 's',
  derivation: ok('success'),
  active: false,
  badge: undefined,
  ...extra,
});

describe('summarize', () => {
  it('counts failing, running, behind and diverged cells separately', () => {
    const model: BoardModel = {
      cells: {
        a: cell({ derivation: ok('failure') }),
        b: cell({ derivation: ok('partialSuccess'), active: true }),
        c: cell({ badge: { kind: 'behind', count: 2 } }),
        d: cell({ badge: { kind: 'diverged', behind: 1, ahead: 1 } }),
        e: cell({ derivation: { kind: 'empty', state: 'error' } }),
      },
      unmapped: [],
      budgets: {},
      refreshedAt: {},
    };
    expect(summarize(model)).toEqual({
      failing: 1,
      running: 1,
      behind: 1,
      diverged: 1,
    });
  });
});
