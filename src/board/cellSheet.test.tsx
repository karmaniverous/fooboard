/**
 * Tests for the cell detail sheet's pinned header (spec.md §3.6, Decision
 * 33): the cell's place is the sheet's visible title, shown once; the
 * title and Close stay outside the body, which alone scrolls the detail;
 * Close closes the sheet.
 *
 * @module
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { githubSet } from '@/domain/derivation/testFixtures';
import { resolveStatus } from '@/domain/statuses/resolved';
import type { BoardCell } from '@/engine';
import {
  applyOverflowUtility,
  scrollContainerOf,
} from '@/test/scrollContainer';

import { CellDetail, CellSheet } from './CellDetail';
import { cellPlace } from './cellView';

const cell: BoardCell = {
  rowId: 'api',
  stageId: 'dev',
  settled: true,
  active: false,
  badge: undefined,
  derivation: {
    kind: 'ok',
    status: resolveStatus(githubSet, githubSet.cell[0]),
    branch: 'dev',
    commit: '0123456789abcdef0123456789abcdef01234567',
    message: 'Fix the deploy\n\nA long story, line after line.',
    document: { branch: 'dev' },
  },
};

const names = { rowName: 'api', stageName: 'Dev' };

let restore: () => void;
beforeEach(() => {
  restore = applyOverflowUtility();
});
afterEach(() => {
  restore();
});

function openSheet(onClose: () => void = () => undefined): HTMLElement {
  render(
    <CellSheet title={cellPlace(names)} onClose={onClose}>
      <CellDetail cell={cell} interactive {...names} />
    </CellSheet>,
  );
  return screen.getByRole('dialog', { name: 'api · Dev' });
}

describe('the cell detail sheet', () => {
  it('pins its title (the cell) and Close over the scrolling detail', () => {
    const sheet = openSheet();
    const body = scrollContainerOf(within(sheet).getByText('Message'));
    expect(sheet).toContainElement(body);
    const title = within(sheet).getByRole('heading', { name: 'api · Dev' });
    const close = within(sheet).getByRole('button', { name: 'Close' });
    expect(body).not.toContainElement(title);
    expect(body).not.toContainElement(close);
    // The title is the only place the cell is named.
    expect(within(sheet).getAllByText('api · Dev')).toEqual([title]);
  });

  it('closes from its pinned Close', () => {
    const onClose = vi.fn();
    const sheet = openSheet(onClose);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps the cell named in the tooltip, which has no title', () => {
    render(<CellDetail cell={cell} interactive={false} {...names} />);
    expect(screen.getByText('api · Dev')).toBeInTheDocument();
  });
});
