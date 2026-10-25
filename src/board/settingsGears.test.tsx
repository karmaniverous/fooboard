/**
 * Tests for the board's settings gears (spec.md §3.11 *Settings on the
 * board*, §3.10): a gear on every row header, stage header and labelled
 * group label, each named for its place; none on an unlabelled group;
 * header gears in the Tab order after their header, one Tab stop per cell
 * (the board's one cell gear is tested in `CellGearLayer.test.tsx`);
 * `,` on a focused cell opening its popup;
 * the cell announcing Space and `,`; and clicks on a cell, header or label
 * doing what they did before.
 *
 * @module
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { omit } from 'radash';
import { beforeAll, describe, expect, it } from 'vitest';

import { demoDashboard } from '@/demo/board';
import { type BoardModel } from '@/engine';
import { TEST_LAYOUT } from '@/test/boardLayout';
import { fullModel } from '@/test/boardModel';
import { cellGear } from '@/test/cellGear';
import { focusElement } from '@/test/focus';
import { renderSettingsBoard } from '@/test/settingsBoard';

import {
  HEADER_GEAR_GAP,
  SETTINGS_GEAR_INSET,
  SETTINGS_GEAR_SIZE,
} from './settingsGearSize';

let model: BoardModel;
beforeAll(async () => {
  model = await fullModel(demoDashboard);
});

// `hidden`: while a popup is open the board behind it is hidden from
// assistive tech (the popup is modal).
const gear = (name: string) =>
  screen.getByRole('button', { name, hidden: true });
const dialogTitle = () =>
  within(screen.getByRole('dialog')).getByRole('heading').textContent;

/** The first status cell's link (a cover link in a grid cell). */
const firstCellLink = (): HTMLElement =>
  within(screen.getAllByRole('gridcell')[0]).getAllByRole('link')[0];

describe('settings gears', () => {
  it('puts a named gear on every header and labelled group label', () => {
    renderSettingsBoard(demoDashboard, model);
    const { rows, stages } = demoDashboard;
    for (const r of rows) gear(`Settings for row ${r.displayName}`);
    for (const s of stages) gear(`Settings for stage ${s.name}`);
    gear('Settings for row group Backend');
    gear('Settings for row group Frontend');
    gear('Settings for column group Preview');
    const g = gear('Settings for row api-core');
    expect(g).toHaveAttribute('aria-haspopup', 'dialog');
    expect(g).toHaveAttribute('aria-expanded', 'false');
  });

  it('sizes gears in ems of the board text, so they scale with zoom', () => {
    renderSettingsBoard(demoDashboard, model);
    // Set around the grid, so the cell gear beside it has them too.
    const grid = screen.getByRole('grid').parentElement ?? document.body;
    const px = (ems: number) => `${String(ems * TEST_LAYOUT.fontPx)}px`;
    expect(grid.style.getPropertyValue('--gear-size')).toBe(
      px(SETTINGS_GEAR_SIZE),
    );
    expect(grid.style.getPropertyValue('--gear-inset')).toBe(
      px(SETTINGS_GEAR_INSET),
    );
    expect(grid.style.getPropertyValue('--gear-gap')).toBe(px(HEADER_GEAR_GAP));
  });

  it('gives an unlabelled group no gear', () => {
    // Each axis keeps one labelled group beside an unlabelled one, so the
    // labelled one's label row or strip is drawn.
    renderSettingsBoard(
      {
        ...demoDashboard,
        rowGroups: demoDashboard.rowGroups.map((g) =>
          g.id === 'backend' ? omit(g, ['label']) : g,
        ),
        columnGroups: [
          ...demoDashboard.columnGroups,
          {
            id: 'later',
            memberIds: ['dev', 'release', 'prod'],
            settings: {},
            stageRules: {},
          },
        ],
      },
      model,
    );
    expect(
      screen
        .getAllByRole('button', { name: /group/ })
        .map((b) => b.getAttribute('aria-label')),
    ).toEqual([
      'Settings for column group Preview',
      'Settings for row group Frontend',
    ]);
    // Rows and stages keep theirs.
    gear('Settings for row api-core');
    gear('Settings for stage Bali');
  });

  it('keeps header gears in the Tab order after their header, and one Tab stop per cell', () => {
    renderSettingsBoard(demoDashboard, model);
    const header = screen.getByRole('rowheader', { name: /api-core/ });
    const rowGear = gear('Settings for row api-core');
    expect(header.contains(rowGear)).toBe(true);
    expect(rowGear.tabIndex).toBe(0);
    const stageHeader = screen.getByRole('columnheader', { name: /Bali/ });
    expect(stageHeader.contains(gear('Settings for stage Bali'))).toBe(true);
    // One Tab stop per cell: its cover link or button; the gear is out.
    // (A cell still loading has neither.)
    const loaded = screen
      .getAllByRole('gridcell')
      .filter((cell) => cell.querySelector('a[href], button'));
    expect(loaded.length).toBeGreaterThan(100);
    for (const cell of loaded) {
      const tabbable = [
        ...cell.querySelectorAll<HTMLElement>('a[href], button'),
      ].filter((el) => el.tabIndex >= 0 && !el.closest('[aria-hidden]'));
      // A badge is its own link, in the text laid over the cover.
      const badges = tabbable.filter((el) =>
        el.parentElement?.closest('.pointer-events-none'),
      );
      expect(tabbable.length - badges.length).toBe(1);
    }
  });

  it('keeps every header gear in a row of the grid, a row group’s in its label’s header, and the cell gear outside the grid', () => {
    renderSettingsBoard(demoDashboard, model);
    const cellGearEl = cellGear('Settings for cell api-core, Bali');
    const headerGears = screen
      .getAllByRole('button', { name: /^Settings for / })
      .filter((g) => g !== cellGearEl);
    expect(headerGears.length).toBeGreaterThan(20);
    for (const g of headerGears) expect(g.closest('[role=row]')).not.toBeNull();
    expect(cellGearEl.closest('[role=grid]')).toBeNull();
    const header = gear('Settings for row group Backend').closest(
      '[role=rowheader]',
    );
    expect(header).toHaveAccessibleName(/^Backend/);
    expect(header).toHaveAttribute(
      'aria-colspan',
      String(demoDashboard.stages.length + 1),
    );
  });

  it('lays the cell gear beside the cell link, never inside it', () => {
    renderSettingsBoard(demoDashboard, model);
    const link = firstCellLink();
    const g = cellGear('Settings for cell api-core, Bali');
    expect(link.contains(g)).toBe(false);
    expect(g.closest('a, [role=gridcell]')).toBeNull();
  });

  it('opens a focused status cell’s popup on comma, and an empty cell’s too', async () => {
    renderSettingsBoard(demoDashboard, model);
    const link = firstCellLink();
    focusElement(link);
    fireEvent.keyDown(link, { key: ',' });
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(dialogTitle()).toBe('Cell settings: api-core × Bali');
    expect(gear('Settings for cell api-core, Bali')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const empty = screen.getAllByRole('button', { name: /^no records/ })[0];
    focusElement(empty);
    fireEvent.keyDown(empty, { key: ',' });
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it.each([
    ['Ctrl', { ctrlKey: true }],
    ['Alt', { altKey: true }],
    ['Meta', { metaKey: true }],
  ])('leaves %s+comma to the browser', (_, modifier) => {
    renderSettingsBoard(demoDashboard, model);
    const link = firstCellLink();
    focusElement(link);
    fireEvent.keyDown(link, { key: ',', ...modifier });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens nothing on other keys, nor on comma at the gear itself', () => {
    renderSettingsBoard(demoDashboard, model);
    const link = firstCellLink();
    fireEvent.keyDown(link, { key: '.' });
    fireEvent.keyDown(cellGear('Settings for cell api-core, Bali'), {
      key: ',',
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('announces Space and comma on status and empty cells, and names both in the focused tooltip', () => {
    renderSettingsBoard(demoDashboard, model);
    const link = firstCellLink();
    expect(link).toHaveAttribute('aria-keyshortcuts', 'Space ,');
    const empty = screen.getAllByRole('button', { name: /^no records/ })[0];
    expect(empty).toHaveAttribute('aria-keyshortcuts', 'Space ,');
    focusElement(link);
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Press Space for details or , (comma) for settings',
    );
  });

  it('opens the popup from a gear click, and nothing from a header, label or cell click', async () => {
    renderSettingsBoard(demoDashboard, model);
    fireEvent.click(screen.getByRole('rowheader', { name: /api-core/ }));
    fireEvent.click(screen.getByRole('columnheader', { name: /Bali/ }));
    fireEvent.click(screen.getByText('Backend'));
    fireEvent.click(screen.getByText('Preview'));
    const link = firstCellLink();
    fireEvent.click(link);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // The cell's click still follows its link (a new tab).
    expect(link).toHaveAttribute('href');
    expect(link).toHaveAttribute('target', '_blank');

    fireEvent.click(gear('Settings for row group Backend'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(dialogTitle()).toBe('Row group settings: Backend');
  });

  it('carries the cell’s gear in its detail sheet, opening the cell’s popup over it', async () => {
    renderSettingsBoard(demoDashboard, model);
    const link = firstCellLink();
    fireEvent.pointerDown(link, { pointerType: 'touch' });
    fireEvent.click(link);
    const sheet = await screen.findByRole('dialog');
    const sheetGear = within(sheet).getByRole('button', {
      name: 'Settings for cell api-core, Bali',
    });
    fireEvent.click(sheetGear);
    const dialogs = await screen.findAllByRole('dialog');
    expect(dialogs.at(-1)).toHaveAccessibleName(
      'Cell settings: api-core × Bali',
    );
  });
});
