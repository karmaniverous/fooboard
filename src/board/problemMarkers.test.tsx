/**
 * Tests for problem markers (spec.md A§4.3.7): a marker lists its
 * problems and, where there is an editor, opens it at the first; cell
 * problems are listed in the cell's detail.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EMPTY_STATES } from '@/domain/derivation';
import { problem } from '@/domain/problems/problem';
import type { BoardCell } from '@/engine';

import { CellDetail } from './CellDetail';
import { ProblemMark } from './ProblemMark';
import { ProblemMarksContext } from './problemMarksContext';

const first = problem({ kind: 'row', id: 'web' }, 'first');
const second = problem({ kind: 'row', id: 'web' }, 'second');
const none = {
  rows: new Map(),
  stages: new Map(),
  cells: new Map(),
  dashboard: [],
};

describe('ProblemMark', () => {
  it('opens the editor at the first problem when clicked', () => {
    const onOpen = vi.fn();
    render(
      <ProblemMarksContext value={{ ...none, onOpen }}>
        <ProblemMark problems={[first, second]} />
      </ProblemMarksContext>,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: '2 problems: first; second. Open the editor at it',
      }),
    );
    expect(onOpen).toHaveBeenCalledWith(first);
  });

  it('only labels where there is no editor, and is absent without problems', () => {
    const { container } = render(
      <>
        <ProblemMark problems={[first]} />
        <ProblemMark problems={[]} />
      </>,
    );
    expect(
      screen.getByRole('img', { name: '1 problem: first' }),
    ).toBeInTheDocument();
    expect(container.textContent).toBe('!');
  });
});

describe('CellDetail', () => {
  it('lists the problems on an empty cell', () => {
    const cell: BoardCell = {
      rowId: 'web',
      stageId: 'dev',
      derivation: { kind: 'empty', state: EMPTY_STATES.noRecords },
      active: false,
      badge: undefined,
      settled: true,
    };
    render(
      <CellDetail
        cell={cell}
        rowName="web"
        stageName="Dev"
        interactive={false}
        problems={[
          problem({ kind: 'cell', rowId: 'web', stageId: 'dev' }, 'read more'),
        ]}
      />,
    );
    expect(screen.getByText('! read more')).toBeInTheDocument();
  });
});
