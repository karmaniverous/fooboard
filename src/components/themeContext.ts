/**
 * The theme choice in React context (see `ThemeProvider`).
 *
 * @module
 */
import { createContext, useContext } from 'react';

import type { ThemeChoice } from '@/domain/config/devicePreferences';

export interface ThemeState {
  theme: ThemeChoice;
  setTheme: (theme: ThemeChoice) => void;
}

export const ThemeContext = createContext<ThemeState | null>(null);

/** The current theme choice and its setter; throws outside the provider. */
export function useTheme(): ThemeState {
  const state = useContext(ThemeContext);
  if (!state) throw new Error('useTheme must be used inside ThemeProvider');
  return state;
}
