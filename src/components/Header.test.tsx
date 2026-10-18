/**
 * Tests for the app header (spec.md C-19): the buttons in their order,
 * Privacy and Terms always in the menu and never buttons, and the theme
 * chosen from the button (cycling) or the menu (three-way), saved on the
 * device.
 *
 * @module
 */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';

import { AppNavProvider } from './AppNavProvider';
import { Header } from './Header';
import { ThemeProvider } from './ThemeProvider';

function renderHeader() {
  const stores = createAppStores(memoryStorage());
  render(
    <StoresContext value={stores}>
      <MemoryRouter>
        <ThemeProvider>
          <AppNavProvider>
            <Header />
          </AppNavProvider>
        </ThemeProvider>
      </MemoryRouter>
    </StoresContext>,
  );
  return stores;
}

const openMenu = () => {
  fireEvent.keyDown(screen.getByRole('button', { name: 'Menu' }), {
    key: 'Enter',
  });
  return screen.getByRole('menu');
};

describe('Header', () => {
  it('shows the buttons in the C-19 order, Privacy and Terms only in the menu', () => {
    renderHeader();
    const nav = screen.getByRole('navigation', { name: 'App' });
    const names = [...nav.querySelectorAll('a, button')].map((e) =>
      e.getAttribute('aria-label'),
    );
    expect(names).toEqual([
      'News & support',
      'README',
      'Try the demo',
      'Theme: System',
      'Share / Export',
      'Import (coming soon)',
      'GitHub',
      'Report an issue',
      'Menu',
    ]);
    const menu = openMenu();
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((i) => i.textContent),
    ).toEqual(['Privacy', 'Terms']);
  });

  it('cycles the theme from its button and saves it on the device', () => {
    const stores = renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Theme: System' }));
    expect(stores.preferences.getTheme()).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Theme: Light' }));
    expect(stores.preferences.getTheme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('opens the Share / Export dialog', () => {
    renderHeader();
    fireEvent.click(screen.getByRole('button', { name: 'Share / Export' }));
    expect(
      screen.getByRole('dialog', { name: 'Share fooboard' }),
    ).toBeInTheDocument();
  });
});
