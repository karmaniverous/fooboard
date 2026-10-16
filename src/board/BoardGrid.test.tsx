/**
 * Tests for the board grid over the demo board: every cell renders, group
 * labels appear, cells link to their jobs, badges link to the compare
 * page, empty states show their text, and a touch tap opens the detail
 * sheet instead of following the link.
 *
 * @module
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { demoDashboard } from '@/demo/board';
import { type BoardModel, createBoardEngine, demoProviders } from '@/engine';

import { BoardGrid } from './BoardGrid';

let model: BoardModel;

beforeAll(async () => {
  const engine = createBoardEngine({
    dashboard: demoDashboard,
    providers: demoProviders(() => 0),
    visibility: { isHidden: () => false, onChange: () => () => undefined },
  });
  await engine.refreshAll();
  model = engine.getModel();
});

const renderBoard = () =>
  render(
    <BoardGrid
      dashboard={demoDashboard}
      model={model}
      rowHeight="compact"
      now={0}
    />,
  );

describe('BoardGrid', () => {
  it('renders every cell with row and column group labels', () => {
    renderBoard();
    expect(screen.getAllByRole('gridcell')).toHaveLength(19 * 6);
    expect(screen.getByText('Commerce')).toBeInTheDocument();
    expect(screen.getByText('Amplify sites')).toBeInTheDocument();
  });

  it('links cells to jobs and badges to the compare page', () => {
    renderBoard();
    const billing = screen.getByRole('rowheader', { name: 'billing' });
    const row = billing.parentElement;
    if (!row) throw new Error('row not found');
    const badge = within(row).getByLabelText(/3 commits behind/);
    expect(badge).toHaveAttribute(
      'href',
      expect.stringContaining('acme/billing/compare/'),
    );
    const job = within(row).getAllByRole('link')[0];
    expect(job).toHaveAttribute('target', '_blank');
    expect(job.getAttribute('href')).toMatch(/actions\/runs\/\d+\/job\//);
  });

  it('opens the detail sheet on a touch tap', () => {
    renderBoard();
    const link = screen.getAllByRole('link', { name: /Success, dev/ })[0];
    fireEvent.pointerDown(link, { pointerType: 'touch' });
    fireEvent.click(link);
    expect(
      screen.getByRole('dialog', { name: 'Cell detail' }),
    ).toBeInTheDocument();
  });
});
