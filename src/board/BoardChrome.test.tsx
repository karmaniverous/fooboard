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
  problems: [],
  amplifyBranches: [],
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
    fireEvent.click(screen.getByRole('radio', { name: /behind/ }));
    expect(onFilter).toHaveBeenLastCalledWith('badge:behind');
    rerender(
      <BoardSummary model={model} filter="badge:behind" onFilter={onFilter} />,
    );
    fireEvent.click(screen.getByRole('radio', { name: /behind/ }));
    expect(onFilter).toHaveBeenLastCalledWith(null);
  });
});

describe('BoardSummary without words', () => {
  it('names each chip in a tooltip', async () => {
    render(
      <BoardSummary
        model={model}
        filter={null}
        onFilter={vi.fn()}
        words={false}
      />,
    );
    fireEvent.focus(screen.getByRole('radio', { name: '0 behind' }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent('0 behind');
  });
});

describe('BudgetMeter', () => {
  it('shows a battery per token, lit by the share left', () => {
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
    const { rerender } = render(
      <BudgetMeter model={model} labels={{ gh: 'acme token' }} />,
    );
    const meter = screen.getByRole('meter', {
      name: /GitHub acme token: 300 of 5,000 requests left/,
    });
    expect(meter).toHaveAttribute('aria-valuenow', '300');
    expect(meter.className).toContain('text-red-600');
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

  it('shows a grey, empty battery for a token not read yet, as an image not a meter', () => {
    render(<BudgetMeter model={model} />);
    const unread = screen.getByRole('img', {
      name: 'GitHub off: requests left not known yet',
    });
    expect(unread).not.toHaveAttribute('aria-valuenow');
    expect(unread.className).toContain('text-muted-foreground');
    // Every meter on the board has a value.
    for (const m of screen.getAllByRole('meter'))
      expect(m).toHaveAttribute('aria-valuenow');
    expect(screen.getAllByRole('meter')).toHaveLength(1);
  });
});
