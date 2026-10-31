/**
 * Tests for the dashboard page's wiring: the Problems button counts
 * problems (or reads *Notes* when there are only notes), *Fix* opens the
 * editor on the problem's tab, *Customise* saves an editable copy of a
 * built-in and opens it, *Dismiss* hides a problem for good (an Amplify
 * source without an AWS key too, its cells still needing one), and the
 * editor opens at General, where the dashboard can be deleted, its device
 * preferences with it.
 *
 * @module
 */
import { fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DevicePreferencesSchema } from '@/domain/config/devicePreferences';
import { branchRules } from '@/domain/config/placement';
import { builtinSourceFor } from '@/domain/model/builtinSources';
import { BUILTIN_KEYS } from '@/domain/model/keys';
import { memoryStorage, readJson } from '@/storage/keyValue';
import { DEVICE_PREFERENCES_KEY } from '@/storage/preferencesStore';
import { HOME_TEXT, renderDashboardPage } from '@/test/renderDashboardPage';

const githubRow = {
  type: 'github',
  id: 'api',
  repo: 'acme/api',
  displayName: 'api',
} as const;

const openPanel = (name: RegExp) => {
  fireEvent.click(screen.getByRole('button', { name }));
  return screen.getByRole('dialog');
};

/** The board has read its rows (none has a credential), looking behind
 * an open panel if need be. */
const settled = () =>
  screen.findAllByRole('button', { name: /needs credential/, hidden: true });

const selectedTab = () =>
  within(screen.getByRole('dialog', { name: 'Edit dashboard' }))
    .getAllByRole('tab')
    .find((t) => t.getAttribute('aria-selected') === 'true')?.textContent;

describe('DashboardPage problems', () => {
  it('counts problems and opens the editor at the fix', async () => {
    await renderDashboardPage({
      id: 'p',
      name: 'P',
      rows: [githubRow],
      stages: [{ id: 'dev', name: 'Dev' }],
    });
    await settled();
    const panel = openPanel(/^Problems \(\d+\)$/);
    const item = within(panel)
      .getByText('no GitHub stage rule: its GitHub cells match nothing')
      .closest('li');
    if (!item) throw new Error('no problem item');
    fireEvent.click(within(item).getByRole('button', { name: 'Fix' }));
    expect(selectedTab()).toBe('Stages');
  });

  it('reads Notes when there are only notes', async () => {
    await renderDashboardPage({
      id: 'n',
      name: 'N',
      stages: [{ id: 'dev', name: 'Dev', rules: branchRules('dev') }],
    });
    expect(screen.queryByRole('button', { name: /^Problems/ })).toBeNull();
    const panel = openPanel(/^Notes \(\d+\)$/);
    expect(within(panel).getAllByText(/rules where no row reads/)).not.toEqual(
      [],
    );
  });

  it('customises a built-in status set with a problem, saving the copy', async () => {
    const github = builtinSourceFor('github');
    const stores = await renderDashboardPage({
      id: 'c',
      name: 'C',
      rows: [githubRow],
      stages: [{ id: 'dev', name: 'Dev', rules: branchRules('dev') }],
      customSourceRules: [
        {
          ...github,
          id: 'mine',
          name: 'Mine',
          items: {
            path: github.items?.path ?? '',
            keys: (github.items?.keys ?? []).map((k) =>
              k.name === BUILTIN_KEYS.state ? { ...k, name: 'status' } : k,
            ),
          },
        },
      ],
      sourceRules: { github: 'mine' },
    });
    await settled();
    const panel = openPanel(/^Problems \(\d+\)$/);
    fireEvent.click(
      within(panel).getAllByRole('button', { name: 'Customise' })[0],
    );
    const loaded = stores.config.load();
    expect(
      loaded.kind === 'ok' && loaded.root.dashboards[0]?.customStatusSets,
    ).toHaveLength(1);
    expect(selectedTab()).toBe('Statuses');
    // The board re-reads with the copy.
    await settled();
  });
});

describe('DashboardPage dismissal', () => {
  it('drops a dismissed note from the count and remembers it', async () => {
    const stores = await renderDashboardPage({
      id: 'd',
      name: 'D',
      stages: [{ id: 'dev', name: 'Dev', rules: branchRules('dev') }],
    });
    const before = screen
      .getByRole('button', { name: /^Notes/ })
      .getAttribute('aria-label');
    const panel = openPanel(/^Notes \(\d+\)$/);
    fireEvent.click(
      within(panel).getAllByRole('button', { name: 'Dismiss' })[0],
    );
    expect(stores.preferences.getView('d').dismissedProblems).toHaveLength(1);
    fireEvent.click(within(panel).getByRole('button', { name: 'Close' }));
    expect(
      screen
        .queryByRole('button', { name: /^Notes/ })
        ?.getAttribute('aria-label'),
    ).not.toBe(before);
  });
});

describe('DashboardPage dismissing an unresolvable AWS key', () => {
  const noKey = /^Dev have no AWS key/;

  it('hides the problem, and the cells still need a credential', async () => {
    await renderDashboardPage({
      id: 'k',
      name: 'K',
      rows: [
        {
          type: 'amplify',
          id: 'site',
          displayName: 'site',
          repo: 'acme/site',
          pinnedApps: [{ region: 'us-east-1', appId: 'a1' }],
        },
      ],
      stages: [{ id: 'dev', name: 'Dev', rules: branchRules('dev') }],
    });
    await settled();
    const panel = openPanel(/^Problems \(\d+\)$/);
    const item = within(panel).getByText(noKey).closest('li');
    if (!item) throw new Error('no problem item');
    fireEvent.click(within(item).getByRole('button', { name: 'Dismiss' }));
    expect(within(panel).queryByText(noKey)).toBeNull();
    fireEvent.click(within(panel).getByRole('button', { name: 'Close' }));
    expect(await settled()).not.toEqual([]);
  });
});

describe('DashboardPage editor', () => {
  it('opens at General from Edit', async () => {
    await renderDashboardPage({ id: 'e', name: 'E' });
    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    expect(selectedTab()).toBe('General');
  });

  it('deletes the dashboard from General, with its device preferences', async () => {
    const device = memoryStorage();
    const stores = await renderDashboardPage({ id: 'x', name: 'Gone' }, device);
    stores.preferences.setView('x', { density: 'compact' });
    stores.preferences.setView('kept', { density: 'compact' });
    const dashboardsWithPreferences = () =>
      Object.keys(
        DevicePreferencesSchema.parse(readJson(device, DEVICE_PREFERENCES_KEY))
          .dashboards,
      );
    expect(dashboardsWithPreferences()).toEqual(['x', 'kept']);
    fireEvent.click(screen.getByRole('button', { name: 'Edit dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete dashboard' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Gone' }));
    const loaded = stores.config.load();
    expect(loaded.kind === 'ok' && loaded.root.dashboards).toEqual([]);
    expect(dashboardsWithPreferences()).toEqual(['kept']);
    expect(screen.getByText(HOME_TEXT)).toBeVisible();
  });
});
