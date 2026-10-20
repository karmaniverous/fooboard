/**
 * Tests for a cell's lines: the lead sits on line 0 with any items the
 * line map puts there, each item on its own line otherwise, and React
 * sees every child of a line keyed.
 *
 * @module
 */
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Lines } from './CellLines';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Lines', () => {
  it('puts the lead and a line-0 item on one line, without a key warning', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <Lines
        lineOf={{ time: 0, branch: 1 }}
        lead={<span>lead</span>}
        items={[
          { key: 'time', node: 'now' },
          { key: 'branch', node: 'main', free: true },
        ]}
      />,
    );
    const first = screen.getByText('lead').parentElement;
    expect(first).toHaveTextContent('leadnow');
    expect(screen.getByText('main').closest('span.flex-1')).not.toBe(first);
    expect(error).not.toHaveBeenCalled();
  });
});
