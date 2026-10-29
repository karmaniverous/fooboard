/**
 * Provides the navigation items' shared state: the *Share / Export* dialog
 * (spec.md C-19, §3.8), which a header button, a menu item or a footer
 * link can open; the *Import* dialog (§3.8), opened the same ways, from
 * the home page, or by a share link; the *Reset* confirmation (§3.9),
 * opened from the menu or the home page's error state; and the dot on
 * the menu's *Release notes* (spec 0.2.0 §3.D), shown while this build's
 * version is newer than the last one this browser has seen (a device
 * preference), until the link is followed. A first visit takes this
 * build's version as seen, so it shows no dot. Each dialog returns focus
 * to what opened it, or to the menu button when that has gone.
 *
 * A share link opened in a new page arrives as `link`, its fragment
 * already cleared before routing (`takeShareLink` in `main.tsx`); one
 * pasted into this tab's address bar changes only the fragment, so it is
 * taken here as it arrives, cleared at once, and the page moves to home.
 * Closing the import dialog discards the link's share.
 *
 * @module
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { APP_VERSION } from '@/lib/site';
import { isUnseen } from '@/lib/versions';
import type { LinkPayload } from '@/share/link';
import { ImportDialog } from '@/share/ui/ImportDialog';
import { useShareLinkArrivals } from '@/share/useShareLinkArrivals';
import { useStores } from '@/storage/storesContext';

import { NavContext } from './navItems';
import { ResetDialog } from './ResetDialog';
import { ShareDialog } from './ShareDialog';

type Opened = 'share' | 'import' | 'reset' | null;

export function AppNavProvider({
  children,
  link: initialLink = null,
}: {
  children: React.ReactNode;
  /** The share link the page was opened with. */
  link?: LinkPayload | null;
}): React.JSX.Element {
  const { preferences } = useStores();
  // A first visit (nothing stored) has seen this build: no dot, ever.
  const [lastSeen, setLastSeen] = useState(
    () => preferences.getLastSeenVersion() ?? APP_VERSION,
  );
  useEffect(() => {
    if (preferences.getLastSeenVersion() === undefined)
      preferences.setLastSeenVersion(APP_VERSION);
  }, [preferences]);
  const [link, setLink] = useState(initialLink);
  // Each link that arrives gets a fresh import dialog, so no choice made
  // for one share carries over to the next.
  const [arrivals, setArrivals] = useState(0);
  const [opened, setOpened] = useState<Opened>(link ? 'import' : null);
  const opener = useRef<HTMLElement | null>(null);
  useShareLinkArrivals(
    useCallback((taken: LinkPayload) => {
      opener.current = null;
      setLink(taken);
      setArrivals((n) => n + 1);
      setOpened('import');
    }, []),
  );
  const value = useMemo(() => {
    const open = (dialog: Opened) => () => {
      opener.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setOpened(dialog);
    };
    return {
      openShare: open('share'),
      openImport: open('import'),
      openReset: open('reset'),
      markReleaseNotesSeen: () => {
        preferences.setLastSeenVersion(APP_VERSION);
        setLastSeen(APP_VERSION);
      },
      releaseNotesUnseen: isUnseen(APP_VERSION, lastSeen),
    };
  }, [lastSeen, preferences]);
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
      // Cancelling discards a link's share.
      if (!next && name === 'import') setLink(null);
    },
    onCloseAutoFocus: returnFocus,
  });
  return (
    <NavContext value={value}>
      {children}
      <ShareDialog {...dialog('share')} />
      <ImportDialog key={arrivals} {...dialog('import')} link={link} />
      <ResetDialog {...dialog('reset')} />
    </NavContext>
  );
}
