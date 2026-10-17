/**
 * Tests for the board chrome: a summary chip toggles its filter on and off,
 * and the budget display flags a credential running low.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { BoardModel } from '@/engine';

import { BoardSummary, BudgetMeter } from './BoardChrome';

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

describe('BoardSummary without words', () => {
  it('names each chip in a hover title', () => {
    render(
      <BoardSummary
        model={model}
        filter={null}
        onFilter={vi.fn()}
        words={false}
      />,
    );
    expect(screen.getByRole('button', { name: '0 failing' })).toHaveAttribute(
      'title',
      '0 failing',
    );
  });
});

describe('BudgetMeter', () => {
  it('shows one battery per credential with a budget, by segments left', () => {
    const at = (remaining: number) => ({
      ...model,
      budgets: {
        gh: {
          limit: 5000,
          remaining,
          reset: 0,
          used: 0,
          status: 'ok' as const,
        },
      },
    });
    const { rerender } = render(<BudgetMeter model={model} />);
    const meter = screen.getByRole('meter', {
      name: /GitHub gh: 300 of 5,000 requests left/,
    });
    expect(meter).toHaveAttribute('aria-valuenow', '300');
    expect(meter.className).toContain('text-red-600');
    expect(screen.getAllByRole('meter')).toHaveLength(1);
    for (const [remaining, colour] of [
      [5000, 'text-green-600'],
      [3000, 'text-yellow-500'],
      [2000, 'text-orange-500'],
      [0, 'text-red-600'],
    ] as const) {
      rerender(<BudgetMeter model={at(remaining)} />);
      expect(screen.getByRole('meter').className).toContain(colour);
    }
  });
});
