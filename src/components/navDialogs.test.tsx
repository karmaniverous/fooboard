/**
 * Tests for the app's dialogs opened from the navigation (spec.md §3.9):
 * they need `AppNavProvider`; *Reset* opened from the menu returns focus
 * to the menu button (its item has gone), and opened from the home page's
 * error state returns it to the button that opened it.
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
import { describe, expect, it, vi } from 'vitest';

import { Home } from '@/pages/Home';
import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { renderShell } from '@/test/renderShell';

import { Header } from './Header';
import { useNavDialogs } from './navItems';

function UsesDialogs(): null {
  useNavDialogs();
  return null;
}

describe('the navigation dialogs', () => {
  it('need AppNavProvider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<UsesDialogs />)).toThrow(
      'the app navigation needs AppNavProvider',
    );
  });

  it('return focus to the menu button after Reset opened from the menu', async () => {
    renderShell(<Header />);
    const menu = screen.getByRole('button', { name: 'Menu' });
    fireEvent.keyDown(menu, { key: 'Enter' });
    fireEvent.click(
      within(screen.getByRole('menu')).getByRole('menuitem', {
        name: 'Reset…',
      }),
    );
    const dialog = screen.getByRole('alertdialog', { name: 'Reset fooboard?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(menu).toHaveFocus();
    });
  });

  it('return focus to the home page’s Reset button', async () => {
    const device = memoryStorage();
    device.setItem('fooboard:config', '{not json');
    renderShell(<Home />, undefined, createAppStores(device));
    const reset = screen.getByRole('button', { name: 'Reset…' });
    reset.focus();
    fireEvent.click(reset);
    const dialog = screen.getByRole('alertdialog', { name: 'Reset fooboard?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => {
      expect(reset).toHaveFocus();
    });
  });
});
