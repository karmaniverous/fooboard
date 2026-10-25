/**
 * Tests for the settings popup's origin links (spec.md §3.11 *Unlabelled
 * groups have no gear*): where the board has a dashboard editor, an
 * unlabelled group named as an origin opens the editor at the group's
 * settings; where it has none (the demo), the origin stays text.
 *
 * @module
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { omit } from 'radash';
import { beforeAll, describe, expect, it } from 'vitest';

import { demoDashboard } from '@/demo/board';
import type { Dashboard } from '@/domain/config/dashboard';
import { type BoardModel } from '@/engine';
import { fullModel } from '@/test/boardModel';
import { renderSettingsBoard } from '@/test/settingsBoard';

let model: BoardModel;
beforeAll(async () => {
  model = await fullModel(demoDashboard);
});

const board = demoDashboard;
const gear = (name: string) =>
  screen.getByRole('button', { name, hidden: true });

/** The backend group without its label, setting the GitHub token, and
 * the name origins give it (its first member's). */
const unlabelled: Dashboard = {
  ...board,
  rowGroups: board.rowGroups.map((g) =>
    g.id === 'backend'
      ? {
          ...omit(g, ['label']),
          // The dashboard's token again: the group's rows show its origin.
          settings: { githubToken: demoDashboard.settings.githubToken },
        }
      : g,
  ),
};
const backendFirst = (() => {
  const id = board.rowGroups.find((g) => g.id === 'backend')?.memberIds[0];
  const row = board.rows.find((r) => r.id === id);
  if (!row) throw new Error('no backend row');
  return row.displayName;
})();

describe('SettingsPopup origin links', () => {
  it('links an unlabelled group’s origin to its settings in the dashboard editor', async () => {
    const { onOpenSettings } = renderSettingsBoard(unlabelled, model);
    fireEvent.click(gear(`Settings for row ${backendFirst}`));
    const dialog = await screen.findByRole('dialog');
    // Named by its first member, as origins name an unlabelled group.
    const link = within(dialog).getByRole('button', {
      name: `from ${backendFirst}: open Row group ${backendFirst} in dashboard settings`,
    });
    // In the link colour of the library's link variant, which passes
    // contrast, as *Open in dashboard settings* is.
    expect(link).toHaveClass('text-primary');
    expect(link.className).not.toMatch(/text-(sky|blue)-/);
    fireEvent.click(link);
    expect(onOpenSettings).toHaveBeenCalledWith({
      level: 'rowGroup',
      groupId: 'backend',
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps an unlabelled group’s origin as text where the board has no editor', async () => {
    renderSettingsBoard(unlabelled, model, { editor: false });
    fireEvent.click(gear(`Settings for row ${backendFirst}`));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(`from ${backendFirst}`).tagName).toBe(
      'SPAN',
    );
  });
});
