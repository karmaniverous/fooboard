/**
 * Provides the navigation items' shared state: the *Share / Export* dialog
 * (spec.md C-19), which a header button, a menu item or a footer link can
 * open.
 *
 * @module
 */
import { useMemo, useRef, useState } from 'react';

import { NavContext } from './navItems';
import { ShareDialog } from './ShareDialog';

export function AppNavProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [shareOpen, setShareOpen] = useState(false);
  const opener = useRef<HTMLElement | null>(null);
  const value = useMemo(
    () => ({
      openShare: () => {
        opener.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        setShareOpen(true);
      },
    }),
    [],
  );
  return (
    <NavContext value={value}>
      {children}
      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        onCloseAutoFocus={(e) => {
          // Opened without a trigger, so Radix has nowhere to return to.
          e.preventDefault();
          const el = opener.current;
          (el?.isConnected
            ? el
            : document.querySelector<HTMLElement>('[data-app-menu-trigger]')
          )?.focus();
        }}
      />
    </NavContext>
  );
}
