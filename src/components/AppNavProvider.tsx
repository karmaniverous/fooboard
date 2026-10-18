/**
 * Provides the navigation items' shared state: the *Share / Export* dialog
 * (spec.md C-19), which a header button, a menu item or a footer link can
 * open.
 *
 * @module
 */
import { useMemo, useState } from 'react';

import { NavContext } from './navItems';
import { ShareDialog } from './ShareDialog';

export function AppNavProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [shareOpen, setShareOpen] = useState(false);
  const value = useMemo(
    () => ({
      openShare: () => {
        setShareOpen(true);
      },
    }),
    [],
  );
  return (
    <NavContext value={value}>
      {children}
      <ShareDialog open={shareOpen} onOpenChange={setShareOpen} />
    </NavContext>
  );
}
