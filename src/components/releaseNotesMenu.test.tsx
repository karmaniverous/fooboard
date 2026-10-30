/**
 * *Release notes* in the app menu (spec 0.2.0 §3.D; Decisions 84 and
 * 100): a link to the releases page in a new tab; the dot on it and on
 * the menu button while this build's version is newer than the last one
 * this browser has seen (a stored 0.1.0 value included), cleared and
 * stored by following the link; a first visit, Reset included, stores
 * this build's version and never shows the dot; never in an export; the
 * app's version in the menu.
 *
 * @module
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Header } from '@/components/Header';
import { APP_VERSION, site } from '@/lib/site';
import { makeShare } from '@/share/exportShare';
import { createAppStores } from '@/storage';
import { dashboardsOf } from '@/storage/configStore';
import { memoryStorage } from '@/storage/keyValue';
import { acmeBoard } from '@/test/acmeBoard';
import { renderShell } from '@/test/renderShell';

/** This build's version in these tests: the release after 0.1.0. */
const { BUILD_VERSION } = vi.hoisted(() => ({ BUILD_VERSION: '0.2.0' }));

vi.mock(import('@/lib/site'), async (importOriginal) => ({
  ...(await importOriginal()),
  APP_VERSION: BUILD_VERSION,
}));

/** A version older than any build's. */
const OLDER = '0.0.1';

/** A version newer than this build's. */
const NEWER = '999.0.0';

const menuButton = () => screen.getByRole('button', { name: 'Menu' });
const dotShown = () =>
  menuButton().querySelector('[data-release-notes-dot]') !== null;

const openMenu = () => {
  fireEvent.keyDown(menuButton(), { key: 'Enter' });
  return screen.getByRole('menu');
};

/** The menu's *Release notes* item, the menu opened. */
const releaseNotes = () =>
  within(openMenu()).getByRole('menuitem', { name: /^Release notes/ });

/** The header over a device that last saw `lastSeen` (nothing stored when
 * undefined); its stores. */
function shell(lastSeen?: string) {
  const device = memoryStorage();
  if (lastSeen !== undefined)
    createAppStores(device).preferences.setLastSeenVersion(lastSeen);
  return renderShell(<Header />, undefined, createAppStores(device));
}

describe('Release notes', () => {
  it('links to the releases page in a new tab', () => {
    shell(APP_VERSION);
    const link = releaseNotes();
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('href', site.releasesUrl);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('marks a version newer than the one last seen, until followed', () => {
    const stores = shell(OLDER);
    expect(dotShown()).toBe(true);
    expect(menuButton()).toHaveAccessibleDescription(
      'New release: see Release notes',
    );
    const link = releaseNotes();
    expect(link).toHaveAccessibleName('Release notes (new release)');
    // The shared attention dot (Decision 105): decoration.
    expect(link.querySelector('[data-release-notes-dot]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );

    fireEvent.click(link);
    expect(dotShown()).toBe(false);
    expect(menuButton()).not.toHaveAccessibleDescription();
    expect(stores.preferences.getLastSeenVersion()).toBe(APP_VERSION);
  });

  it('carries over the value 0.1.0 stored when its notes were seen', () => {
    // 0.1.0 kept the same preference, so 0.2.0's dot shows once.
    const stores = shell('0.1.0');
    expect(dotShown()).toBe(true);
    expect(stores.preferences.getLastSeenVersion()).toBe('0.1.0');
  });

  it.each([
    ['this build', APP_VERSION],
    ['a newer build (an older site)', NEWER],
  ])('shows no dot once %s was seen', (_, lastSeen) => {
    shell(lastSeen);
    expect(dotShown()).toBe(false);
    expect(releaseNotes()).toHaveAccessibleName('Release notes');
  });

  it('shows no dot on a first visit, and stores this build as seen', () => {
    const stores = shell();
    expect(dotShown()).toBe(false);
    expect(stores.preferences.getLastSeenVersion()).toBe(APP_VERSION);
  });

  it('shows no dot after Reset, which makes the next load a first visit', async () => {
    const device = memoryStorage();
    const stores = createAppStores(device);
    stores.preferences.setLastSeenVersion(OLDER);
    await act(() => stores.reset());
    renderShell(<Header />, undefined, createAppStores(device));
    expect(dotShown()).toBe(false);
  });

  it('is never part of an export', async () => {
    const device = memoryStorage();
    const stores = createAppStores(device);
    stores.config.saveDashboard(acmeBoard);
    stores.preferences.setLastSeenVersion(NEWER);
    const share = await makeShare(
      dashboardsOf(stores.config.load()),
      { include: true, passphrase: null },
      (id) => stores.credentials.get(id),
    );
    const text = JSON.stringify(share);
    expect(text).toContain(acmeBoard.name);
    expect(text).not.toContain('lastSeen');
    expect(text).not.toContain(NEWER);
  });

  it("shows the app's version at the foot of the menu", () => {
    shell(APP_VERSION);
    const menu = openMenu();
    const version = within(menu).getByText(`fooboard ${APP_VERSION}`);
    // Text, not an item: the arrows skip it, and Reset stays the last item.
    expect(version).not.toHaveAttribute('role', 'menuitem');
    expect(within(menu).getAllByRole('menuitem').at(-1)).toHaveTextContent(
      'Reset…',
    );
  });
});
