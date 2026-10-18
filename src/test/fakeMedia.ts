/**
 * A controllable `prefers-color-scheme` query for theme tests: its
 * listeners are visible, and `set` changes the OS setting.
 *
 * @module
 */
import type { ThemeMedia } from '@/lib/theme';

type Listener = (e: { matches: boolean }) => void;

export function fakeMedia(matches: boolean): {
  media: ThemeMedia;
  listeners: ReadonlySet<Listener>;
  set: (dark: boolean) => void;
} {
  const listeners = new Set<Listener>();
  return {
    media: {
      matches,
      addEventListener: (_, l) => {
        listeners.add(l);
      },
      removeEventListener: (_, l) => {
        listeners.delete(l);
      },
    },
    listeners,
    set(dark) {
      for (const l of listeners) l({ matches: dark });
    },
  };
}
