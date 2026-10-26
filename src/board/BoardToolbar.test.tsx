/**
 * Tests for the board toolbar's hidden measuring copy of the summary chips:
 * it is clipped, so its natural width never widens the page.
 *
 * @module
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BoardToolbar } from './BoardToolbar';

const noop = () => undefined;

describe('BoardToolbar', () => {
  it('clips the measuring copy of the summary chips', () => {
    render(
      <BoardToolbar
        zoom={1}
        range={{ min: 0.5, top: 1, max: 2 }}
        onZoom={noop}
        onStep={noop}
        density="default"
        onDensity={noop}
        lead={({ words }) => <span>{words ? 'six problems' : '6'}</span>}
      />,
    );
    // The copy keeps its natural width (it is what gets measured) inside a
    // box that fills the toolbar and hides what overflows (C-13).
    const measure = screen.getByTestId('toolbar-measure');
    expect(measure).toHaveClass('absolute', 'inset-0', 'overflow-hidden');
    const copy = measure.querySelector('[data-measure="lead"]');
    expect(copy).toHaveClass('w-max');
    expect(copy).toHaveTextContent('six problems');
  });
});
