/**
 * Tests for the app header (spec.md C-19): the buttons in their order,
 * folding into the menu as it narrows (before the separator, Privacy and
 * Terms always after it), the theme chosen from the button (cycling) or
 * the menu (three-way) and saved on the device, the saved theme applied on
 * load, the header's height published for the board, and Share / Export
 * and Import opening their dialogs.
 *
 * @module
 */
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { focusElement } from '@/test/focus';
import { fakeLayout } from '@/test/layout';
import { renderShell } from '@/test/renderShell';

import { Header } from './Header';

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.classList.remove('dark');
});

const MEASURED: Record<string, number> = { brand: 100, menu: 32, tagline: 200 };
/** Lay the header out `width` px wide: buttons 32 px, 49 px tall. */
const layOut = (width: number) => {
  fakeLayout({ tag: 'HEADER', width }, (el) => {
    if (el.tagName === 'HEADER') return { height: 49 };
    const name = el.getAttribute('data-measure');
    return { width: name ? (MEASURED[name] ?? 32) : 0 };
  });
};

const buttonNames = () =>
  [
    ...screen
      .getByRole('navigation', { name: 'App' })
      .querySelectorAll('a, button'),
  ].map((e) => e.getAttribute('aria-label'));

const openMenu = () => {
  fireEvent.keyDown(screen.getByRole('button', { name: 'Menu' }), {
    key: 'Enter',
  });
  return screen.getByRole('menu');
};

describe('Header', () => {
  it('shows every button in the C-19 order when wide, with only Privacy and Terms in the menu', () => {
    layOut(1400);
    renderShell(<Header />);
    expect(buttonNames()).toEqual([
      'News & support',
      'README',
      'Try the demo',
      'Theme: System',
      'Share / Export',
      'Import',
      'Set up with an AI assistant',
      'GitHub',
      'Report an issue',
      'Menu',
    ]);
    expect(
      within(openMenu())
        .getAllByRole('menuitem')
        .map((i) => i.textContent),
    ).toEqual(['Privacy', 'Terms', 'Release notes', 'Reset…']);
  });

  it('folds buttons into the menu, before the separator, when narrow', () => {
    // Room for News and README (196 px with the fixed parts), not the tagline.
    layOut(300);
    renderShell(<Header />);
    expect(buttonNames()).toEqual(['News & support', 'README', 'Menu']);
    expect(
      screen.queryByText("Welcome to DevOps hell. Here's your map.", {
        ignore: '[aria-hidden="true"] *',
      }),
    ).toBeNull();
    const menu = openMenu();
    expect(
      [...menu.querySelectorAll('[role^=menuitem]')].map((i) => i.textContent),
    ).toEqual([
      'Try the demo',
      'Theme: System',
      'Theme: Light',
      'Theme: Dark',
      'Share / Export',
      'Import',
      'Set up with an AI assistant',
      'GitHub',
      'Report an issue',
      'Privacy',
      'Terms',
      'Release notes',
      'Reset…',
    ]);
    const order = [
      ...menu.querySelectorAll('[role^=menuitem], [role=separator]'),
    ].map((e) => e.textContent || '---');
    expect(order.indexOf('---')).toBe(order.indexOf('Privacy') - 1);
  });

  it('sets the theme from the menu and saves it on the device', () => {
    layOut(300);
    const stores = renderShell(<Header />);
    fireEvent.click(
      within(openMenu()).getByRole('menuitemradio', { name: 'Theme: Dark' }),
    );
    expect(stores.preferences.getTheme()).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('cycles the theme from its button: System, Light, Dark, System', () => {
    const stores = renderShell(<Header />);
    for (const [from, to] of [
      ['System', 'light'],
      ['Light', 'dark'],
      ['Dark', 'system'],
    ]) {
      fireEvent.click(screen.getByRole('button', { name: `Theme: ${from}` }));
      expect(stores.preferences.getTheme()).toBe(to);
    }
  });

  it('applies the theme saved on the device when it loads', () => {
    renderShell(<Header />, 'dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Theme: Dark' }),
    ).toBeInTheDocument();
  });

  it('publishes its height for the board headers that pin below it', () => {
    layOut(1400);
    renderShell(<Header />);
    expect(
      document.documentElement.style.getPropertyValue('--app-header-h'),
    ).toBe('49px');
  });

  it.each([
    ['Share / Export', 'Share fooboard'],
    ['Import', 'Import dashboards'],
    ['Set up with an AI assistant', 'Set up with an AI assistant'],
  ])('opens %s in its dialog', (button, dialog) => {
    renderShell(<Header />);
    fireEvent.click(screen.getByRole('button', { name: button }));
    expect(screen.getByRole('dialog', { name: dialog })).toBeInTheDocument();
  });

  it('opens Set up with an AI assistant from the menu once it has folded', () => {
    layOut(300);
    renderShell(<Header />);
    fireEvent.click(
      within(openMenu()).getByRole('menuitem', {
        name: 'Set up with an AI assistant',
      }),
    );
    expect(
      screen.getByRole('dialog', { name: 'Set up with an AI assistant' }),
    ).toBeInTheDocument();
  });

  it.each(['Light', 'Dark', 'System'] as const)(
    'sets Theme: %s from the menu and saves it',
    (label) => {
      layOut(300);
      const stores = renderShell(
        <Header />,
        label === 'System' ? 'dark' : undefined,
      );
      fireEvent.click(
        within(openMenu()).getByRole('menuitemradio', {
          name: `Theme: ${label}`,
        }),
      );
      expect(stores.preferences.getTheme()).toBe(label.toLowerCase());
      expect(document.documentElement.classList.contains('dark')).toBe(
        label === 'Dark',
      );
    },
  );

  it.each(['Escape', 'Close'] as const)(
    'returns focus to the Share / Export button after %s',
    async (how) => {
      renderShell(<Header />);
      const share = screen.getByRole('button', { name: 'Share / Export' });
      focusElement(share);
      fireEvent.click(share);
      const dialog = screen.getByRole('dialog');
      if (how === 'Escape') fireEvent.keyDown(dialog, { key: 'Escape' });
      else
        fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      // Radix moves focus on close after a tick.
      await waitFor(() => {
        expect(share).toHaveFocus();
      });
    },
  );

  it('returns focus to the menu button when Share / Export was opened from the menu', async () => {
    layOut(300);
    renderShell(<Header />);
    fireEvent.click(
      within(openMenu()).getByRole('menuitem', { name: 'Share / Export' }),
    );
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Menu' })).toHaveFocus();
    });
  });
});
