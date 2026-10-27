/**
 * Provides the navigation items' shared state: the *Share / Export* dialog
 * (spec.md C-19, §3.8), which a header button, a menu item or a footer
 * link can open; the *Import* dialog (§3.8), opened the same ways, from
 * the home page, or by a share link; the *Reset* confirmation (§3.9),
 * opened from the menu or the home page's error state; and What's new
 * (C-20, §3.10), opened from the menu, whose dot shows while the newest
 * release in the bundled changelog is newer than the last one this
 * browser has seen (a device preference), until What's new is opened.
 * Each returns focus to what opened it, or to the menu button when that
 * has gone.
 *
 * A share link opened in a new page arrives as `link`, its fragment
 * already cleared before routing (`takeShareLink` in `main.tsx`); one
 * pasted into this tab's address bar changes only the fragment, so it is
 * taken here as it arrives, cleared at once, and the page moves to home.
 * Closing the import dialog discards the link's share.
 *
 * @module
 */
import { useCallback, useMemo, useRef, useState } from 'react';

import type { LinkPayload } from '@/share/link';
import { ImportDialog } from '@/share/ui/ImportDialog';
import { useShareLinkArrivals } from '@/share/useShareLinkArrivals';
import { useStores } from '@/storage/storesContext';
import { isUnseen, type Release } from '@/whatsNew/changelog';
import { RELEASES } from '@/whatsNew/releases';
import { WhatsNewDialog } from '@/whatsNew/WhatsNewDialog';

import { NavContext } from './navItems';
import { ResetDialog } from './ResetDialog';
import { ShareDialog } from './ShareDialog';

type Opened = 'share' | 'import' | 'reset' | 'whatsNew' | null;

export function AppNavProvider({
  children,
  link: initialLink = null,
  releases = RELEASES,
}: {
  children: React.ReactNode;
  /** The share link the page was opened with. */
  link?: LinkPayload | null;
  /** What's new's releases, newest first (the bundled changelog's). */
  releases?: readonly Release[];
}): React.JSX.Element {
  const { preferences } = useStores();
  const newest = releases.at(0)?.version;
  const [lastSeen, setLastSeen] = useState(() =>
    preferences.getLastSeenVersion(),
  );
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
    const openWhatsNew = open('whatsNew');
    return {
      openShare: open('share'),
      openImport: open('import'),
      openReset: open('reset'),
      openWhatsNew: () => {
        openWhatsNew();
        if (newest === undefined) return;
        preferences.setLastSeenVersion(newest);
        setLastSeen(newest);
      },
      whatsNewUnseen: isUnseen(newest, lastSeen),
    };
  }, [newest, lastSeen, preferences]);
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
      <WhatsNewDialog {...dialog('whatsNew')} releases={releases} />
    </NavContext>
  );
}
