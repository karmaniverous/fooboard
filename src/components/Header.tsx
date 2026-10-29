/**
 * The app header (spec.md C-19): pinned to the top of the window and to
 * its width; one row that never wraps. Logo and name, the tagline, then
 * icon buttons in the C-19 order, then the menu. As the row narrows,
 * buttons fold into the menu from the right, then the tagline goes, and
 * README and News & support go last; chosen by measuring the content.
 * Privacy and Terms are always in the menu, never buttons; then *Release
 * notes* (spec 0.2.0 §3.D), a link to the releases page whose dot, on it
 * and on the menu button, marks a version this browser hasn't seen until
 * the link is followed; *Reset* is the menu's last
 * item (spec.md §3.9), nowhere else in the header; under it, the app's
 * version (Decision 25).
 *
 * @module
 */
import { Menu, RotateCcw, Sparkles } from 'lucide-react';
import { useId, useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FOLD_ORDER, foldCount } from '@/lib/headerFold';
import { APP_VERSION, site } from '@/lib/site';
import {
  contentWidth,
  gapOf,
  measuredWidth,
  useMeasured,
} from '@/lib/useMeasured';
import { cn, PINNED_FULL } from '@/lib/utils';

import { ExternalLink } from './ExternalLink';
import { NavControl } from './NavControl';
import { useNavDialogs, useNavItems } from './navItems';
import { NavMenuEntry } from './NavMenuEntry';

/** The unseen-version dot (spec 0.2.0 §3.D): decoration; the names say
 * it. */
function NewDot({ className }: { className?: string }): React.JSX.Element {
  return (
    <span
      aria-hidden
      data-release-notes-dot
      className={cn('size-2 rounded-full bg-status-started', className)}
    />
  );
}

function Brand(): React.JSX.Element {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2.5 font-bold">
      <img
        src={site.logoUrl}
        alt=""
        width={26}
        height={26}
        className="rounded-md"
      />
      <span>{site.name}</span>
    </Link>
  );
}

export function Header(): React.JSX.Element {
  const items = useNavItems();
  const { openReset, markReleaseNotesSeen, releaseNotesUnseen } =
    useNavDialogs();
  const newReleaseId = useId();
  const buttons = items.filter((i) => !i.legal);
  const legal = items.filter((i) => i.legal);
  const [ref, folded] = useMeasured<HTMLElement, number>((el) => {
    // Not laid out (no width yet): nothing folded.
    if (el.clientWidth === 0) return 0;
    const widths = Object.fromEntries(
      FOLD_ORDER.map((id) => [id, measuredWidth(el, id)]),
    );
    return foldCount(
      widths,
      measuredWidth(el, 'brand') + measuredWidth(el, 'menu'),
      contentWidth(el),
      gapOf(el),
    );
  }, 0);
  const hidden = new Set(FOLD_ORDER.slice(0, folded));
  const inMenu = buttons.filter((b) => hidden.has(b.id));

  // Board headers pin just below this one (--app-header-h).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const update = () => {
      root.style.setProperty(
        '--app-header-h',
        `${String(el.getBoundingClientRect().height)}px`,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, [ref]);

  return (
    <header
      ref={ref}
      className={cn(
        PINNED_FULL,
        'top-0 z-40 flex items-center gap-2 overflow-hidden whitespace-nowrap border-b border-border bg-chrome px-5 py-2 text-foreground',
      )}
    >
      {/* Natural widths of every part, for the fold (never shown). */}
      <div
        aria-hidden
        inert
        className="invisible absolute left-0 top-0 flex w-max gap-2"
      >
        <span data-measure="brand">
          <Brand />
        </span>
        <span data-measure="tagline" className="text-sm">
          {site.tagline}
        </span>
        {buttons.map((b) => (
          <span key={b.id} data-measure={b.id}>
            <NavControl item={b} form="icon" />
          </span>
        ))}
        <span data-measure="menu" className="size-8" />
      </div>

      <Brand />
      {!hidden.has('tagline') && (
        <span className="min-w-0 truncate text-sm text-muted-foreground">
          {site.tagline}
        </span>
      )}
      <nav aria-label="App" className="ml-auto flex items-center gap-2">
        {buttons
          .filter((b) => !hidden.has(b.id))
          .map((b) => (
            <NavControl key={b.id} item={b} form="icon" />
          ))}
        {/* Non-modal: no scroll lock, so the page scrollbar stays and the
            layout does not shift when the menu opens. */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger
            aria-label="Menu"
            aria-describedby={releaseNotesUnseen ? newReleaseId : undefined}
            data-app-menu-trigger
            className="relative flex size-8 items-center justify-center rounded-md hover:bg-foreground/10"
          >
            <Menu className="size-5" />
            {releaseNotesUnseen && (
              <NewDot className="absolute right-0.5 top-0.5" />
            )}
          </DropdownMenuTrigger>
          {releaseNotesUnseen && (
            <span id={newReleaseId} hidden>
              New release: see Release notes
            </span>
          )}
          <DropdownMenuContent align="end">
            {inMenu.map((item) => (
              <NavMenuEntry key={item.id} item={item} />
            ))}
            {inMenu.length > 0 && <DropdownMenuSeparator />}
            {legal.map((item) => (
              <NavMenuEntry key={item.id} item={item} />
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="gap-2">
              <ExternalLink
                unstyled
                href={site.releasesUrl}
                onClick={markReleaseNotesSeen}
              >
                <Sparkles className="size-4" />
                Release notes
                {releaseNotesUnseen && (
                  <>
                    {' '}
                    <span className="sr-only">(new release)</span>
                    <NewDot className="ml-auto" />
                  </>
                )}
              </ExternalLink>
            </DropdownMenuItem>
            <DropdownMenuItem className="gap-2" onSelect={openReset}>
              <RotateCcw className="size-4" />
              Reset…
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel data-app-version>
              {site.name} {APP_VERSION}
            </DropdownMenuLabel>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </header>
  );
}
