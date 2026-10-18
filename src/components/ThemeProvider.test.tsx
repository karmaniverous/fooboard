/**
 * Tests for ThemeProvider (spec.md C-14): a saved Light or Dark wins over
 * the OS, survives a remount, and only System listens to the OS (the
 * listener goes when the choice changes or the provider unmounts).
 *
 * @module
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ThemeChoice } from '@/domain/config/devicePreferences';
import { type AppStores, createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';

import { useTheme } from './themeContext';
import { ThemeProvider } from './ThemeProvider';

/** The OS setting, with its listeners counted. */
function fakeOs(dark: boolean) {
  const listeners = new Set<(e: { matches: boolean }) => void>();
  vi.spyOn(window, 'matchMedia').mockImplementation(
    () =>
      ({
        matches: dark,
        addEventListener: (_: string, l: (e: { matches: boolean }) => void) => {
          listeners.add(l);
        },
        removeEventListener: (
          _: string,
          l: (e: { matches: boolean }) => void,
        ) => {
          listeners.delete(l);
        },
      }) as unknown as MediaQueryList,
  );
  return listeners;
}

/** A button per choice, to set it from inside the provider. */
function Chooser(): React.JSX.Element {
  const { setTheme } = useTheme();
  return (
    <>
      {(['system', 'light', 'dark'] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => {
            setTheme(t);
          }}
        >
          {t}
        </button>
      ))}
    </>
  );
}
const choose = (t: ThemeChoice) => {
  fireEvent.click(screen.getByRole('button', { name: t }));
};
const mount = (stores: AppStores) =>
  render(
    <StoresContext value={stores}>
      <ThemeProvider>
        <Chooser />
      </ThemeProvider>
    </StoresContext>,
  );
const isDark = () => document.documentElement.classList.contains('dark');

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.classList.remove('dark');
});

describe('ThemeProvider', () => {
  it.each([
    ['light', true, false],
    ['dark', false, true],
  ] as const)(
    'applies a saved %s over the OS, and again after a remount',
    (saved, osDark, dark) => {
      const listeners = fakeOs(osDark);
      const stores = createAppStores(memoryStorage());
      stores.preferences.setTheme(saved);
      mount(stores).unmount();
      document.documentElement.classList.toggle('dark', !dark);
      mount(stores);
      expect(isDark()).toBe(dark);
      expect(listeners.size).toBe(0);
    },
  );

  it('follows the OS only while System, and stops on change and unmount', () => {
    const listeners = fakeOs(true);
    const view = mount(createAppStores(memoryStorage()));
    expect(isDark()).toBe(true);
    expect(listeners.size).toBe(1);
    act(() => {
      for (const l of listeners) l({ matches: false });
    });
    expect(isDark()).toBe(false);
    choose('dark');
    expect(listeners.size).toBe(0);
    choose('system');
    expect(listeners.size).toBe(1);
    view.unmount();
    expect(listeners.size).toBe(0);
  });
});
