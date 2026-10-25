/**
 * Tests for the board grid under a summary filter (spec.md C-13): cells
 * the filter doesn't match are dimmed, the ones it matches are not, and
 * each keeps its gear.
 *
 * @module
 */
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it } from 'vitest';

import { demoDashboard } from '@/demo/board';
import type { BoardModel } from '@/engine';
import { TEST_LAYOUT } from '@/test/boardLayout';
import { fullModel } from '@/test/boardModel';

import { BoardGrid } from './BoardGrid';
import { matchesFilter } from './summary';

let model: BoardModel;
beforeAll(async () => {
  model = await fullModel(demoDashboard);
});

const FILTER = 'badge:behind';

describe('BoardGrid filter', () => {
  it('dims the cells the filter does not match, and only those', () => {
    render(
      <MemoryRouter>
        <BoardGrid
          dashboard={demoDashboard}
          model={model}
          layout={TEST_LAYOUT}
          now={0}
          filter={FILTER}
        />
      </MemoryRouter>,
    );
    const cells = screen.getAllByRole('gridcell');
    const dimmed = cells.filter((c) => c.classList.contains('opacity-25'));
    const matching = Object.values(model.cells).filter((c) =>
      matchesFilter(c, FILTER),
    );
    expect(matching.length).toBeGreaterThan(0);
    expect(dimmed).toHaveLength(cells.length - matching.length);
    // A matching cell is shown in full: a behind badge in it.
    const shown = cells.find((c) => !c.classList.contains('opacity-25'));
    expect(
      shown && within(shown).getAllByRole('link', { name: /behind/ }),
    ).not.toHaveLength(0);
  });
});
