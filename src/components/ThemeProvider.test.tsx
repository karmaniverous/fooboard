/**
 * Tests for ThemeProvider (spec.md C-14): a saved Light or Dark wins over
 * the OS, survives a remount, and only System listens to the OS (the
 * listener goes when the choice changes or the provider unmounts).
 *
 * @module
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type { ThemeChoice } from '@/domain/config/devicePreferences';
import type { ThemeMedia } from '@/lib/theme';
import { type AppStores, createAppStores } from '@/storage';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext } from '@/storage/storesContext';
import { fakeMedia } from '@/test/fakeMedia';

import { useTheme } from './themeContext';
import { ThemeProvider } from './ThemeProvider';

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
const mount = (stores: AppStores, media: ThemeMedia) =>
  render(
    <StoresContext value={stores}>
      <ThemeProvider media={media}>
        <Chooser />
      </ThemeProvider>
    </StoresContext>,
  );
const isDark = () => document.documentElement.classList.contains('dark');

afterEach(() => {
  document.documentElement.classList.remove('dark');
});

describe('ThemeProvider', () => {
  it.each([
    ['light', true, false],
    ['dark', false, true],
  ] as const)(
    'applies a saved %s over the OS, and again after a remount',
    (saved, osDark, dark) => {
      const os = fakeMedia(osDark);
      const stores = createAppStores(memoryStorage());
      stores.preferences.setTheme(saved);
      mount(stores, os.media).unmount();
      document.documentElement.classList.toggle('dark', !dark);
      mount(stores, os.media);
      expect(isDark()).toBe(dark);
      expect(os.listeners.size).toBe(0);
    },
  );

  it('follows the OS only while System, and stops on change and unmount', () => {
    const os = fakeMedia(true);
    const view = mount(createAppStores(memoryStorage()), os.media);
    expect(isDark()).toBe(true);
    expect(os.listeners.size).toBe(1);
    act(() => {
      os.set(false);
    });
    expect(isDark()).toBe(false);
    choose('dark');
    expect(os.listeners.size).toBe(0);
    choose('system');
    expect(os.listeners.size).toBe(1);
    view.unmount();
    expect(os.listeners.size).toBe(0);
  });
});
