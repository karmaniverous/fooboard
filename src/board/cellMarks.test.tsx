/**
 * Tests for cell marks (spec.md §3.1, Decision 37): a provisional cell is
 * dashed, in its status's look or neutral when its set has no status of
 * that name; a refreshing cell carries a corner dot; both join the cell's
 * accessible name, and neither changes the cell's layout classes.
 *
 * @module
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { githubSet } from '@/domain/derivation/testFixtures';
import { resolveStatus } from '@/domain/statuses/resolved';
import type { BoardCell } from '@/engine';

import { Cell } from './Cell';
import { MARK_LABELS, markedLook, markWords } from './cellMarks';

const look = { className: 'bg-red-600 text-white', style: { color: 'red' } };

const cell = (extra: Partial<BoardCell> = {}): BoardCell => ({
  rowId: 'api',
  stageId: 'dev',
  settled: false,
  active: false,
  badge: undefined,
  derivation: {
    kind: 'ok',
    status: resolveStatus(
      githubSet,
      githubSet.cell.find((c) => c.id === 'testFailed'),
    ),
    branch: 'dev',
    commit: 'abc1234',
    linkUrl: 'https://example.com/run',
    document: { branch: 'dev' },
  },
  ...extra,
});

const renderCell = (c: BoardCell) =>
  render(<Cell cell={c} rung={1} lineOf={{}} now={0} />);

describe('markedLook', () => {
  it('dashes a provisional cell in its status look', () => {
    const marked = markedLook({ provisional: 'status' }, look);
    expect(marked.style).toBe(look.style);
    expect(marked.className).toContain('bg-red-600');
    expect(marked.className).toContain('outline-dashed');
  });

  it('draws a neutral provisional cell without status colour', () => {
    const marked = markedLook({ provisional: 'neutral' }, look);
    expect(marked.style).toBeUndefined();
    expect(marked.className).not.toContain('bg-red-600');
    expect(marked.className).toContain('outline-dashed');
  });

  it('leaves a final cell as it is', () => {
    expect(markedLook({}, look)).toBe(look);
  });
});

describe('cell marks on the board', () => {
  it('names the marks a cell carries', () => {
    expect(markWords({ provisional: 'neutral', refreshing: true })).toEqual([
      MARK_LABELS.provisional,
      MARK_LABELS.refreshing,
    ]);
    expect(markWords({})).toEqual([]);
  });

  it('shows a refreshing dot and says so in the cell’s name', () => {
    renderCell(cell({ refreshing: true }));
    expect(screen.getByTestId('refreshing-mark')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAccessibleName(/refreshing/);
  });

  it('says a provisional cell is provisional, with no dot', () => {
    renderCell(cell({ provisional: 'status' }));
    expect(screen.queryByTestId('refreshing-mark')).toBeNull();
    expect(screen.getByRole('link')).toHaveAccessibleName(/provisional/);
  });

  it('adds nothing to a final cell', () => {
    renderCell(cell({ settled: true }));
    expect(screen.getByRole('link')).not.toHaveAccessibleName(
      /provisional|refreshing/,
    );
  });
});
