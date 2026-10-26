/**
 * Tests for the column-group label strip (spec.md C-14b): absent unless a
 * group has a label; a labelled group is a column header spanning its
 * stages, in its own grid columns past the gutters; ungrouped stretches
 * are no header; no label carries a frame line (the frame is drawn once,
 * `ColumnFrames`); labels pin just right of the row names; the strip pins
 * to the top and reaches across the gap to the stage headers.
 *
 * @module
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ColumnGroupLabels } from './ColumnGroupLabels';
import { columnTracks } from './groupGutters';

const strip = (segments: Parameters<typeof ColumnGroupLabels>[0]['segments']) =>
  render(
    <div role="grid">
      <ColumnGroupLabels
        segments={segments}
        columns={columnTracks(segments).stageColumn}
        rowHeight={20}
        gap={4}
        labelLeft={140}
      />
    </div>,
  );

/** Any border on a label would be a frame line drawn on it. */
const hasBorder = (el: Element) => /\bborder/.test(el.className);

describe('ColumnGroupLabels', () => {
  it('renders nothing when no column group has a label', () => {
    strip([
      {
        group: { id: 'g', memberIds: ['a'], settings: {}, stageRules: {} },
        start: 0,
        span: 1,
      },
    ]);
    expect(screen.getByRole('grid')).toBeEmptyDOMElement();
  });

  it('puts a labelled group as a pinned header over its stages, label pinned left', () => {
    const { container } = strip([
      { start: 0, span: 1 },
      {
        group: {
          id: 'g',
          label: 'Preview',
          memberIds: ['b', 'c'],
          settings: {},
          stageRules: {},
        },
        start: 1,
        span: 2,
      },
    ]);
    const header = screen.getByRole('columnheader', { name: 'Preview' });
    expect(header).toHaveAttribute('aria-colspan', '2');
    // Row names in column 1, the ungrouped stage in 2, the gutter in 3.
    expect(header.style.gridColumn).toBe('4 / span 2');
    expect(hasBorder(header)).toBe(false);
    // Pinned while scrolling down, reaching across the gap to the stage
    // headers so the frame is unbroken.
    expect(header).toHaveClass('sticky');
    expect(header.style.height).toBe('24px');
    expect(header.style.marginBottom).toBe('-4px');
    // The pinned span holds the label and its gear.
    expect(screen.getByText('Preview').parentElement?.style.left).toBe('140px');

    const ungrouped = container.querySelector('[role=presentation]');
    if (!ungrouped) throw new Error('no ungrouped segment');
    expect(ungrouped).toHaveStyle({ gridColumn: '2 / span 1' });
    expect(hasBorder(ungrouped)).toBe(false);
    expect(screen.getAllByRole('columnheader')).toHaveLength(1);
  });
});
