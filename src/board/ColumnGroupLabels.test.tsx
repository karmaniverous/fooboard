/**
 * Tests for the column-group label strip (spec.md C-14b): absent unless a
 * group has a label; a labelled group is a column header spanning its
 * stages, framed on top and both sides; ungrouped stretches are neither;
 * labels pin just right of the row names; the strip pins to the top and
 * reaches across the gap to the stage headers.
 *
 * @module
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ColumnGroupLabels } from './ColumnGroupLabels';

const strip = (segments: Parameters<typeof ColumnGroupLabels>[0]['segments']) =>
  render(
    <div role="grid">
      <ColumnGroupLabels
        segments={segments}
        rowHeight={20}
        gap={4}
        pinLeft=""
        labelLeft={140}
      />
    </div>,
  );

const FRAME = ['border-t-2', 'border-l-2', 'border-r-2'];

describe('ColumnGroupLabels', () => {
  it('renders nothing when no column group has a label', () => {
    strip([
      {
        group: { id: 'g', memberIds: ['a'], stageRules: {} },
        start: 0,
        span: 1,
      },
    ]);
    expect(screen.getByRole('grid')).toBeEmptyDOMElement();
  });

  it('frames a labelled group as a pinned header over its stages, label pinned left', () => {
    const { container } = strip([
      { start: 0, span: 1 },
      {
        group: {
          id: 'g',
          label: 'Preview',
          memberIds: ['b', 'c'],
          stageRules: {},
        },
        start: 1,
        span: 2,
      },
    ]);
    const header = screen.getByRole('columnheader', { name: 'Preview' });
    expect(header).toHaveAttribute('aria-colspan', '2');
    expect(header.style.gridColumn).toBe('3 / span 2');
    for (const c of FRAME) expect(header).toHaveClass(c);
    // Pinned while scrolling down, reaching across the gap to the stage
    // headers so the frame is unbroken.
    expect(header).toHaveClass('sticky');
    expect(header.style.height).toBe('24px');
    expect(header.style.marginBottom).toBe('-4px');
    expect(screen.getByText('Preview').style.left).toBe('140px');

    const ungrouped = container.querySelector('[role=presentation]');
    expect(ungrouped).not.toBeNull();
    for (const c of FRAME) expect(ungrouped).not.toHaveClass(c);
    expect(screen.getAllByRole('columnheader')).toHaveLength(1);
  });
});
