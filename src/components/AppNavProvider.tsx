/**
 * Provides the navigation items' shared state: the *Share / Export* dialog
 * (spec.md C-19), which a header button, a menu item or a footer link can
 * open, and the *Reset* confirmation (§3.9), opened from the menu or the
 * home page's error state. Each returns focus to what opened it, or to the
 * menu button when that has gone.
 *
 * @module
 */
import { useCallback, useMemo, useRef, useState } from 'react';

import { NavContext } from './navItems';
import { ResetDialog } from './ResetDialog';
import { ShareDialog } from './ShareDialog';

type Opened = 'share' | 'reset' | null;

export function AppNavProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [opened, setOpened] = useState<Opened>(null);
  const opener = useRef<HTMLElement | null>(null);
  const value = useMemo(() => {
    const open = (dialog: Opened) => () => {
      opener.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setOpened(dialog);
    };
    return { openShare: open('share'), openReset: open('reset') };
  }, []);
  const returnFocus = useCallback((e: Event) => {
    // Opened without a trigger, so Radix has nowhere to return to.
    e.preventDefault();
    const el = opener.current;
    (el?.isConnected
      ? el
      : document.querySelector<HTMLElement>('[data-app-menu-trigger]')
    )?.focus();
  }, []);
  const dialog = (name: Exclude<Opened, null>) => ({
    open: opened === name,
    onOpenChange: (next: boolean) => {
      setOpened(next ? name : null);
    },
    onCloseAutoFocus: returnFocus,
  });
  return (
    <NavContext value={value}>
      {children}
      <ShareDialog {...dialog('share')} />
      <ResetDialog {...dialog('reset')} />
    </NavContext>
  );
}
