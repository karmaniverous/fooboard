/**
 * The theme choice for the whole app (spec.md C-14): read from and saved
 * to device preferences, applied to the page as it changes.
 *
 * @module
 */
import { useLayoutEffect, useMemo, useState } from 'react';

import type { ThemeChoice } from '@/domain/config/devicePreferences';
import { applyTheme, type ThemeMedia } from '@/lib/theme';
import { useStores } from '@/storage/storesContext';

import { ThemeContext } from './themeContext';

export function ThemeProvider({
  children,
  media,
}: {
  children: React.ReactNode;
  /** The OS colour-scheme query (the window's by default). */
  media?: ThemeMedia;
}): React.JSX.Element {
  const { preferences } = useStores();
  const [theme, setChoice] = useState(() => preferences.getTheme());
  // Before paint, so the page never flashes the other theme.
  useLayoutEffect(() => applyTheme(theme, undefined, media), [theme, media]);
  const value = useMemo(
    () => ({
      theme,
      setTheme: (next: ThemeChoice) => {
        preferences.setTheme(next);
        setChoice(next);
      },
    }),
    [theme, preferences],
  );
  return <ThemeContext value={value}>{children}</ThemeContext>;
}
