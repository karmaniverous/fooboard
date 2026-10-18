/**
 * Tests for the board grid over the demo board: every cell renders, group
 * labels appear, cells link to their jobs, badges link to the compare
 * page, empty states show their text, and a touch tap opens the detail
 * sheet instead of following the link.
 *
 * @module
 */
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it } from 'vitest';

import { demoDashboard } from '@/demo/board';
import {
  type BoardModel,
  createBoardEngine,
  demoProviders,
  emptyModel,
} from '@/engine';

import { BoardGrid } from './BoardGrid';
import type { Layout } from './layout';

/** Rung 1, one line, as on a small screen. */
const testLayout: Layout = {
  rung: 1,
  format: 'line',
  lineOf: {},
  fontPx: 13,
  rowNameWidth: 120,
  colWidth: 100,
  rowHeight: 26,
  lineRowHeight: 26,
  gap: 3,
  padX: 8,
  padY: 4,
  overflowX: false,
  overflowY: false,
  boardHeight: 600,
};

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

// The detail sheet links to the credential guide, so render inside a router.
const renderBoard = (layout: Layout = testLayout) =>
  render(
    <MemoryRouter>
      <BoardGrid
        dashboard={demoDashboard}
        model={model}
        layout={layout}
        now={0}
      />
    </MemoryRouter>,
  );

describe('BoardGrid', () => {
  it('renders every cell with row and column group labels', () => {
    renderBoard();
    expect(screen.getAllByRole('gridcell')).toHaveLength(19 * 6);
    expect(screen.getByText('Preview')).toBeInTheDocument();
    expect(
      screen.getByRole('rowgroup', { name: 'Backend' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('rowgroup', { name: 'Frontend' }),
    ).toBeInTheDocument();
  });

  it('links cells to jobs and badges to the compare page', () => {
    renderBoard();
    const billing = screen.getByRole('rowheader', { name: 'billing' });
    const row = billing.parentElement;
    if (!row) throw new Error('row not found');
    const badge = within(row).getByRole('link', { name: /^3 commits behind/ });
    expect(badge).toHaveAttribute(
      'href',
      expect.stringContaining('acme/billing/compare/'),
    );
    const job = within(row).getAllByRole('link')[0];
    expect(job).toHaveAttribute('target', '_blank');
    expect(job.getAttribute('href')).toMatch(/actions\/runs\/\d+\/job\//);
  });

  it('puts the badge after the commit from rung 3, and in the lead below', () => {
    const badgeIn = (rung: Layout['rung']) => {
      const { unmount } = renderBoard({
        ...testLayout,
        rung,
        format: 'packed',
        lineOf: { time: 1, commit: 1 },
      });
      const row = screen.getByRole('rowheader', {
        name: 'billing',
      }).parentElement;
      if (!row) throw new Error('row not found');
      const badge = within(row).getByRole('link', {
        name: /^3 commits behind/,
      });
      // The commit hash is the badge's previous sibling only after the commit.
      const before = badge.previousElementSibling?.textContent ?? '';
      unmount();
      return /^[0-9a-f]{7}$/.test(before);
    };
    expect(badgeIn(1)).toBe(false);
    expect(badgeIn(3)).toBe(true);
  });

  it('opens the detail sheet on a touch tap', () => {
    renderBoard();
    const link = screen.getAllByRole('link', { name: /Passed, dev/ })[0];
    fireEvent.pointerDown(link, { pointerType: 'touch' });
    fireEvent.click(link);
    expect(
      screen.getByRole('dialog', { name: 'Cell detail' }),
    ).toBeInTheDocument();
  });

  it('shows commit subjects in the hover tooltip, without unreachable links', () => {
    renderBoard();
    // The cell link's name ends with its badge description.
    const cellLink = screen.getAllByRole('link', {
      name: /, \d+ commits behind/,
    })[0];
    fireEvent.mouseEnter(cellLink);
    const tip = screen.getByRole('tooltip');
    expect(
      within(tip).getByText('Missing from this branch'),
    ).toBeInTheDocument();
    expect(within(tip).queryByRole('link')).toBeNull();
    fireEvent.mouseLeave(cellLink);
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('opens a modal sheet with the links, focused, closing on Escape', async () => {
    renderBoard();
    const cellLink = screen.getAllByRole('link', {
      name: /, \d+ commits behind/,
    })[0];
    cellLink.focus();
    fireEvent.pointerDown(cellLink, { pointerType: 'touch' });
    fireEvent.click(cellLink);
    const sheet = screen.getByRole('dialog', { name: 'Cell detail' });
    expect(within(sheet).getByText('Compare on GitHub')).toHaveAttribute(
      'target',
      '_blank',
    );
    expect(within(sheet).getByText('Open job')).toBeInTheDocument();
    expect(sheet.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document.activeElement ?? sheet, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    // Radix returns focus after a tick.
    await waitFor(() => {
      expect(document.activeElement).toBe(cellLink);
    });
  });

  it('makes empty cells reachable and openable at rung 1', () => {
    renderBoard(); // rung 1 shows the state label
    const needs = screen.getAllByRole('button', { name: /needs credential/ });
    expect(needs.length).toBeGreaterThan(0);
    expect(needs[0]).toHaveTextContent('needs credential');
    fireEvent.click(needs[0]);
    const detail = screen.getByRole('dialog', { name: 'Cell detail' });
    expect(within(detail).getByText('needs credential')).toBeInTheDocument();
    expect(
      within(detail).getByRole('link', { name: /How to set up a credential/ }),
    ).toHaveAttribute('href', expect.stringMatching(/#credentials$/));
  });

  it('renders a 40 x 8 board (spec.md step 10 size check)', () => {
    const template = demoDashboard.rows[0];
    const stages = Array.from({ length: 8 }, (_, i) => ({
      id: `s${String(i)}`,
      name: `Stage ${String(i)}`,
      branchPattern: 'main',
    }));
    const big = {
      ...demoDashboard,
      stages,
      rowGroups: [],
      columnGroups: [],
      rows: Array.from({ length: 40 }, (_, i) => ({
        ...template,
        id: `r${String(i)}`,
        displayName: `repo ${String(i)}`,
      })),
    };
    render(
      <BoardGrid
        dashboard={big}
        model={emptyModel()}
        layout={testLayout}
        now={0}
      />,
    );
    expect(screen.getAllByRole('gridcell')).toHaveLength(320);
  });

  it('shows the full row and stage names in tooltips from the keyboard', async () => {
    renderBoard();
    const row = screen.getByRole('rowheader', { name: 'billing' });
    row.focus();
    expect(row).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'billing (acme/billing)',
    );
    const stage = screen.getByRole('columnheader', { name: 'Bali' });
    stage.focus();
    expect(stage).toHaveFocus();
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent(/^Bali \(/);
    });
  });
});
