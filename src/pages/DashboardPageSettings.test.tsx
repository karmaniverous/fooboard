/**
 * Tests for settings on a saved dashboard's board (spec.md §3.11 *Settings
 * on the board*): a gear's popup saves each change to the dashboard at
 * once, and *Open in dashboard settings* opens *Edit dashboard* on the
 * place's tab with its item and settings open.
 *
 * @module
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { branchRules } from '@/domain/config/placement';
import { choose } from '@/test/choose';
import { renderDashboardPage } from '@/test/renderDashboardPage';

const dashboard = {
  id: 's',
  name: 'S',
  rows: [
    {
      type: 'github',
      id: 'api',
      repo: 'acme/api',
      displayName: 'api',
    } as const,
  ],
  stages: [{ id: 'dev', name: 'Dev', rules: branchRules('dev') }],
};

const editor = () => screen.getByRole('dialog', { name: 'Edit dashboard' });
const selectedTab = () =>
  within(editor())
    .getAllByRole('tab')
    .find((t) => t.getAttribute('aria-selected') === 'true')?.textContent;

describe('DashboardPage settings popup', () => {
  it('saves a popup edit to the dashboard at once', async () => {
    const stores = await renderDashboardPage(dashboard);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Settings for row api' }),
    );
    const dialog = await screen.findByRole('dialog');
    choose(
      within(dialog).getByRole('combobox', {
        name: 'GitHub status set for Row api',
      }),
      'GitHub single job',
    );
    const loaded = stores.config.load();
    expect(
      loaded.kind === 'ok' &&
        loaded.root.dashboards[0]?.rows[0]?.settings.statusSets,
    ).toEqual({ github: expect.any(String) as unknown });
  });

  it.each([
    ['Settings for row api', 'Rows', 'GitHub token for Row api'],
    ['Settings for stage Dev', 'Stages', 'GitHub token for Column Dev'],
    ['Settings for cell api, Dev', 'Rows', 'GitHub token for Cell api × Dev'],
  ])(
    'opens the dashboard editor at the place from %s',
    async (gearName, tab, field) => {
      await renderDashboardPage(dashboard);
      fireEvent.click(
        await screen.findByRole('button', { name: gearName, hidden: true }),
      );
      const dialog = await screen.findByRole('dialog');
      fireEvent.click(
        within(dialog).getByRole('button', {
          name: 'Open in dashboard settings',
        }),
      );
      expect(selectedTab()).toBe(tab);
      // The place's settings are open there.
      expect(
        within(editor()).getByRole('combobox', { name: field }),
      ).toBeVisible();
    },
  );
});
