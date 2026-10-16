/**
 * Tests for the board chrome: a summary chip toggles its filter on and off,
 * and the budget display flags a credential running low.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { BoardModel } from '@/engine';

import { BoardSummary, BudgetDisplay } from './BoardChrome';

const model: BoardModel = {
  cells: {},
  unmapped: [],
  budgets: {
    gh: { limit: 5000, remaining: 300, reset: 0, used: 4700, status: 'low' },
    off: undefined,
  },
  refreshedAt: {},
};

describe('BoardSummary', () => {
  it('toggles a filter on, and off again', () => {
    const onFilter = vi.fn();
    const { rerender } = render(
      <BoardSummary model={model} filter={null} onFilter={onFilter} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /failing/ }));
    expect(onFilter).toHaveBeenLastCalledWith('failing');
    rerender(
      <BoardSummary model={model} filter="failing" onFilter={onFilter} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /failing/ }));
    expect(onFilter).toHaveBeenLastCalledWith(null);
  });
});

describe('BudgetDisplay', () => {
  it('shows only credentials with a budget, flagging a low one', () => {
    render(<BudgetDisplay model={model} />);
    const budget = screen.getByText(/GitHub gh: 300 of 5,000 left/);
    expect(budget.className).toContain('text-status-failure');
    expect(screen.queryByText(/GitHub off/)).toBeNull();
  });
});
