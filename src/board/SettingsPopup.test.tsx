/**
 * Tests for the board's settings popup (spec.md §3.11 *The popup*,
 * Decisions 52, 54 and 55): it renders the shared settings editor for the
 * gear's place, saves each change at once (*Not saved* when refused), is
 * one popup at a time, takes focus to its first field and keeps Tab
 * inside, returns focus on Escape to what opened it, links to the
 * dashboard editor where the board has one (and an unlabelled group's
 * origin to its settings), and is a bottom sheet on narrow screens.
 *
 * @module
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it, onTestFinished } from 'vitest';

import { demoDashboard } from '@/demo/board';
import type { Dashboard } from '@/domain/config/dashboard';
import { type BoardModel } from '@/engine';
import { fullModel } from '@/test/boardModel';
import { choose } from '@/test/choose';
import { focusElement } from '@/test/focus';
import { fakeMediaQueries } from '@/test/mediaQuery';
import { renderSettingsBoard } from '@/test/settingsBoard';

let model: BoardModel;
beforeAll(async () => {
  model = await fullModel(demoDashboard);
});

/** A second GitHub credential to choose. */
const OTHER = {
  id: 'gh-other',
  kind: 'github' as const,
  label: 'Other GitHub',
};
const board: Dashboard = {
  ...demoDashboard,
  credentials: [...demoDashboard.credentials, OTHER],
};

const gear = (name: string) =>
  screen.getByRole('button', { name, hidden: true });
/** Press Escape, letting Radix's focus return (a timer) run in act. */
const escape = async (el: HTMLElement) => {
  await act(async () => {
    fireEvent.keyDown(el, { key: 'Escape' });
    await new Promise((r) => setTimeout(r, 0));
  });
};

describe('SettingsPopup', () => {
  it('edits the gear’s place through the settings editor, saving at once', async () => {
    const { onChange } = renderSettingsBoard(board, model);
    fireEvent.click(gear('Settings for row api-core'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('Row settings: api-core');
    for (const field of [
      'GitHub token',
      'GitHub status set',
      'GitHub item rule',
    ])
      expect(within(dialog).getByText(field)).toBeInTheDocument();
    expect(within(dialog).getByText(/^from /)).toBeInTheDocument();
    choose(
      within(dialog).getByRole('combobox', {
        name: 'GitHub token for Row api-core',
      }),
      'Other GitHub',
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    const saved = onChange.mock.calls[0][0];
    expect(
      saved.rows.find((r) => r.id === 'api-core')?.settings.githubToken,
    ).toBe(OTHER.id);
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Reset to inherited: GitHub token for Row api-core',
      }),
    );
    expect(
      onChange.mock.calls[1]?.[0].rows.find((r) => r.id === 'api-core')
        ?.settings.githubToken,
    ).toBeUndefined();
  });

  it('edits a cell at that cell, showing its resolved values', async () => {
    const { onChange } = renderSettingsBoard(board, model);
    fireEvent.click(gear('Settings for cell api-core, Bali'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('Cell settings: api-core × Bali');
    choose(
      within(dialog).getByRole('combobox', {
        name: 'GitHub token for Cell api-core × Bali',
      }),
      'Other GitHub',
    );
    expect(
      onChange.mock.calls[0]?.[0].rows.find((r) => r.id === 'api-core')
        ?.cellSettings.bali?.githubToken,
    ).toBe(OTHER.id);
  });

  it('shows Not saved when the save fails, and leaves the board as it was', async () => {
    const { onChange } = renderSettingsBoard(board, model, {
      save: () => {
        throw new Error('storage is full');
      },
    });
    fireEvent.click(gear('Settings for stage Bali'));
    const dialog = await screen.findByRole('dialog');
    choose(
      within(dialog).getByRole('combobox', {
        name: 'GitHub token for Column Bali',
      }),
      'Other GitHub',
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(within(dialog).getByRole('alert')).toHaveTextContent(
      /^Not saved: .*storage is full$/,
    );
    expect(
      within(dialog).getByRole('combobox', {
        name: 'GitHub token for Column Bali',
      }),
    ).toHaveTextContent('Dashboard default (Demo GitHub)');
  });

  it('refuses a change the schema rejects', async () => {
    // A row setting naming a credential the dashboard doesn't have.
    const broken: Dashboard = {
      ...board,
      rows: board.rows.map((r) =>
        r.id === 'api-core' ? { ...r, settings: { githubToken: 'gone' } } : r,
      ),
    };
    const { onChange } = renderSettingsBoard(broken, model);
    fireEvent.click(gear('Settings for row api-core'));
    const dialog = await screen.findByRole('dialog');
    choose(
      within(dialog).getByRole('combobox', {
        name: 'GitHub status set for Row api-core',
      }),
      'GitHub single job',
    );
    expect(onChange).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('alert')).toHaveTextContent(/^Not saved: /);
  });

  it('opens one popup at a time: another gear replaces it', async () => {
    renderSettingsBoard(board, model);
    fireEvent.click(gear('Settings for row api-core'));
    await screen.findByRole('dialog');
    fireEvent.click(gear('Settings for stage Bali'));
    const dialogs = screen.getAllByRole('dialog');
    expect(dialogs).toHaveLength(1);
    expect(dialogs[0]).toHaveAccessibleName('Stage settings: Bali');
    expect(gear('Settings for row api-core')).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(gear('Settings for stage Bali')).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('takes focus to its first field, keeps Tab inside, and returns it to the gear on Escape', async () => {
    renderSettingsBoard(board, model);
    const rowGear = gear('Settings for row api-core');
    focusElement(rowGear);
    fireEvent.click(rowGear);
    const dialog = await screen.findByRole('dialog');
    const first = within(dialog).getByRole('combobox', {
      name: 'GitHub token for Row api-core',
    });
    expect(first).toHaveFocus();
    // Tab from the last control wraps to the first (a trapped scope).
    const close = within(dialog).getByRole('button', { name: 'Close' });
    const controls = [
      ...dialog.querySelectorAll<HTMLElement>('button, [role=combobox]'),
    ];
    const last = controls.at(-1);
    if (!last) throw new Error('no controls');
    focusElement(last);
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect([close, first]).toContain(document.activeElement);
    await escape(dialog);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(rowGear).toHaveFocus();
  });

  it('closes an open choice list on Escape before the popup', async () => {
    renderSettingsBoard(board, model);
    fireEvent.click(gear('Settings for row api-core'));
    const dialog = await screen.findByRole('dialog');
    const field = within(dialog).getByRole('combobox', {
      name: 'GitHub token for Row api-core',
    });
    fireEvent.keyDown(field, { key: 'Enter' });
    const option = screen.getAllByRole('option')[0];
    fireEvent.keyDown(option, { key: 'Escape' });
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBe(dialog);
    await escape(dialog);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('returns focus to the cell whose comma opened it', async () => {
    renderSettingsBoard(board, model);
    const link = within(screen.getAllByRole('gridcell')[0]).getAllByRole(
      'link',
    )[0];
    focusElement(link);
    fireEvent.keyDown(link, { key: ',' });
    const dialog = await screen.findByRole('dialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    await escape(dialog);
    expect(link).toHaveFocus();
  });

  it('opens the dashboard editor at the item, closing the popup', async () => {
    const { onOpenSettings } = renderSettingsBoard(board, model);
    fireEvent.click(gear('Settings for column group Preview'));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(
      within(dialog).getByRole('button', {
        name: 'Open in dashboard settings',
      }),
    );
    expect(onOpenSettings).toHaveBeenCalledWith({
      level: 'columnGroup',
      groupId: 'preview',
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Focus goes on to the editor, not back to the gear.
    await act(() => new Promise((r) => setTimeout(r, 0)));
    expect(gear('Settings for column group Preview')).not.toHaveFocus();
  });

  it('has no Open in dashboard settings where the board has no editor (the demo)', async () => {
    renderSettingsBoard(board, model, { editor: false });
    fireEvent.click(gear('Settings for row api-core'));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).queryByRole('button', {
        name: 'Open in dashboard settings',
      }),
    ).not.toBeInTheDocument();
  });

  it('is a bottom sheet under the narrow breakpoint, its Close in the pinned header', async () => {
    const media = fakeMediaQueries((q) => q === '(width < 640px)');
    onTestFinished(media.restore);
    renderSettingsBoard(board, model);
    fireEvent.click(gear('Settings for row api-core'));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAccessibleName('Row settings: api-core');
    const header = dialog.querySelector('[data-panel-header]');
    const body = dialog.querySelector('[data-panel-body]');
    if (!(header instanceof HTMLElement) || !(body instanceof HTMLElement))
      throw new Error('no pinned layout');
    expect(
      within(header).getByRole('button', { name: 'Close' }),
    ).toBeInTheDocument();
    expect(within(body).getByText('GitHub token')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(within(header).getByRole('button', { name: 'Close' }));
      await Promise.resolve();
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
