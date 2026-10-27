/**
 * What's new in the app menu (spec.md C-20, §3.10; Decision 44 item 3):
 * the dot on the menu button and the item while the newest release is
 * one this browser hasn't seen, cleared by opening What's new and kept
 * on the device; Reset clears it, so the dot comes back; never in an
 * export; the entries collapse, one open at a time, newest first, each
 * with its post on X; the app's version in the menu.
 *
 * @module
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Header } from '@/components/Header';
import { APP_VERSION } from '@/lib/site';
import { makeShare } from '@/share/exportShare';
import { createAppStores } from '@/storage';
import { dashboardsOf } from '@/storage/configStore';
import { memoryStorage } from '@/storage/keyValue';
import { acmeBoard } from '@/test/acmeBoard';
import { isOpen, itemTrigger } from '@/test/openItem';
import { renderShell } from '@/test/renderShell';

import type { Release } from './changelog';

const POST = 'https://x.com/fooboarding/status/1850000000000000000';

const RELEASES: Release[] = [
  {
    version: '0.2.0',
    date: '2026-11-02',
    sections: [{ title: 'Features', items: ['**Gears** on headers'] }],
    xPost: POST,
  },
  {
    version: '0.1.0',
    date: '2026-10-28',
    sections: [{ title: 'Bug Fixes', items: ['Focus stays in the popup'] }],
  },
];

const menuButton = () => screen.getByRole('button', { name: 'Menu' });
const dotShown = () =>
  menuButton().querySelector('[data-whats-new-dot]') !== null;

const openMenu = () => {
  fireEvent.keyDown(menuButton(), { key: 'Enter' });
  return screen.getByRole('menu');
};

/** Open What's new from the menu; its dialog. */
const openWhatsNew = () => {
  fireEvent.click(
    within(openMenu()).getByRole('menuitem', { name: /^What's new/ }),
  );
  return screen.getByRole('dialog', { name: "What's new" });
};

const shell = (
  device = memoryStorage(),
  releases: readonly Release[] = RELEASES,
) => renderShell(<Header />, undefined, createAppStores(device), releases);

describe("What's new", () => {
  it('marks a release this browser has never seen, until opened', () => {
    const device = memoryStorage();
    const stores = shell(device);
    expect(dotShown()).toBe(true);
    expect(menuButton()).toHaveAccessibleDescription(
      "New release: see What's new",
    );
    expect(
      within(openMenu()).getByRole('menuitem', {
        name: "What's new (new release)",
      }),
    ).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

    fireEvent.keyDown(openWhatsNew(), { key: 'Escape' });
    expect(dotShown()).toBe(false);
    expect(menuButton()).not.toHaveAccessibleDescription();
    expect(stores.preferences.getLastSeenVersion()).toBe('0.2.0');
  });

  it('remembers the newest release seen on this device', () => {
    const device = memoryStorage();
    createAppStores(device).preferences.setLastSeenVersion('0.2.0');
    shell(device);
    expect(dotShown()).toBe(false);
    expect(
      within(openMenu()).getByRole('menuitem', { name: "What's new" }),
    ).toBeInTheDocument();
  });

  it('marks a release newer than the one last seen', () => {
    const device = memoryStorage();
    createAppStores(device).preferences.setLastSeenVersion('0.1.0');
    shell(device);
    expect(dotShown()).toBe(true);
  });

  it('shows the dot again after Reset', async () => {
    const device = memoryStorage();
    const stores = createAppStores(device);
    stores.preferences.setLastSeenVersion('0.2.0');
    await act(() => stores.reset());
    shell(device);
    expect(dotShown()).toBe(true);
  });

  it('is never part of an export', async () => {
    const device = memoryStorage();
    const stores = createAppStores(device);
    stores.config.saveDashboard(acmeBoard);
    stores.preferences.setLastSeenVersion('0.2.0');
    const share = await makeShare(
      dashboardsOf(stores.config.load()),
      { include: true, passphrase: null },
      (id) => stores.credentials.get(id),
    );
    const text = JSON.stringify(share);
    expect(text).toContain(acmeBoard.name);
    expect(text).not.toMatch(/lastSeen|0\.2\.0/);
  });

  it('lists the releases collapsed, newest open, one open at a time', () => {
    shell();
    const dialog = openWhatsNew();
    expect(isOpen('0.2.0')).toBe(true);
    expect(isOpen('0.1.0')).toBe(false);
    expect(within(dialog).getByText('Gears').tagName).toBe('STRONG');
    expect(
      within(dialog).getByRole('link', { name: 'The 0.2.0 post on X' }),
    ).toHaveAttribute('href', POST);
    expect(within(dialog).queryByText('Focus stays in the popup')).toBeNull();

    fireEvent.click(itemTrigger('0.1.0'));
    expect(isOpen('0.1.0')).toBe(true);
    expect(isOpen('0.2.0')).toBe(false);
    expect(
      within(dialog).getByText('Focus stays in the popup'),
    ).toBeInTheDocument();
    // An entry without a post has no link to one.
    expect(
      within(dialog).queryByRole('link', { name: /post on X/ }),
    ).toBeNull();
  });

  it('says so when the build has no release yet, and marks nothing', () => {
    const stores = shell(memoryStorage(), []);
    expect(dotShown()).toBe(false);
    const dialog = openWhatsNew();
    expect(within(dialog).getByText(/No releases yet/)).toBeInTheDocument();
    expect(stores.preferences.getLastSeenVersion()).toBeUndefined();
  });

  it("shows the app's version at the foot of the menu", () => {
    shell();
    const menu = openMenu();
    const version = within(menu).getByText(`fooboard ${APP_VERSION}`);
    // Text, not an item: the arrows skip it, and Reset stays the last item.
    expect(version).not.toHaveAttribute('role', 'menuitem');
    expect(within(menu).getAllByRole('menuitem').at(-1)).toHaveTextContent(
      'Reset…',
    );
  });
});
