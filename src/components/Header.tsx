/**
 * The app header (spec.md C-19): pinned to the top of the window and to
 * its width; one row that never wraps. Logo and name, the tagline, then
 * icon buttons in the C-19 order, then the menu. As the row narrows,
 * buttons fold into the menu from the right, then the tagline goes, and
 * README and News & support go last; chosen by measuring the content.
 * Privacy and Terms are always in the menu, never buttons.
 *
 * @module
 */
import { Menu } from 'lucide-react';
import { useLayoutEffect } from 'react';
import { Link } from 'react-router-dom';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ThemeChoiceSchema } from '@/domain/config/devicePreferences';
import { FOLD_ORDER, foldCount } from '@/lib/headerFold';
import { site } from '@/lib/site';
import { measuredWidth, useMeasured } from '@/lib/useMeasured';
import { cn, PINNED_FULL } from '@/lib/utils';

import { ExternalLink } from './ExternalLink';
import { NavControl } from './NavControl';
import { type NavItem, THEME_LABEL, useNavItems } from './navItems';
import { useTheme } from './themeContext';

const logoUrl = `${import.meta.env.BASE_URL}favicon.svg`;

function Brand(): React.JSX.Element {
  return (
    <Link to="/" className="flex shrink-0 items-center gap-2.5 font-bold">
      <img src={logoUrl} alt="" width={26} height={26} className="rounded-md" />
      <span>{site.name}</span>
    </Link>
  );
}

function MenuEntry({ item }: { item: NavItem }): React.JSX.Element {
  const { theme, setTheme } = useTheme();
  if (item.id === 'theme')
    return (
      <DropdownMenuRadioGroup
        aria-label="Theme"
        value={theme}
        onValueChange={(v) => {
          const next = ThemeChoiceSchema.safeParse(v);
          if (next.success) setTheme(next.data);
        }}
      >
        {ThemeChoiceSchema.options.map((t) => (
          <DropdownMenuRadioItem key={t} value={t}>
            Theme: {THEME_LABEL[t]}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    );
  const body = (
    <>
      <item.Icon className="size-4" />
      {item.label}
    </>
  );
  const look = 'gap-2';
  if (item.href)
    return (
      <DropdownMenuItem asChild className={look}>
        <ExternalLink unstyled href={item.href}>
          {body}
        </ExternalLink>
      </DropdownMenuItem>
    );
  if (item.to)
    return (
      <DropdownMenuItem asChild className={look}>
        <Link to={item.to}>{body}</Link>
      </DropdownMenuItem>
    );
  return (
    <DropdownMenuItem
      className={look}
      disabled={item.disabled}
      onSelect={item.onSelect}
    >
      {body}
    </DropdownMenuItem>
  );
}

export function Header(): React.JSX.Element {
  const items = useNavItems();
  const buttons = items.filter((i) => !i.legal);
  const legal = items.filter((i) => i.legal);
  const [ref, folded] = useMeasured<HTMLElement, number>((el) => {
    // Not laid out (no width yet): nothing folded.
    if (el.clientWidth === 0) return 0;
    const widths = Object.fromEntries(
      FOLD_ORDER.map((id) => [id, measuredWidth(el, id)]),
    );
    const style = getComputedStyle(el);
    const room =
      el.clientWidth -
      parseFloat(style.paddingLeft || '0') -
      parseFloat(style.paddingRight || '0');
    return foldCount(
      widths,
      measuredWidth(el, 'brand') + measuredWidth(el, 'menu'),
      room,
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
        'top-0 z-40 flex items-center gap-2 overflow-hidden whitespace-nowrap border-b border-border bg-background px-5 py-2 text-foreground',
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
            className="flex size-8 items-center justify-center rounded-md hover:bg-accent"
          >
            <Menu className="size-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {inMenu.map((item) => (
              <MenuEntry key={item.id} item={item} />
            ))}
            {inMenu.length > 0 && <DropdownMenuSeparator />}
            {legal.map((item) => (
              <MenuEntry key={item.id} item={item} />
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    </header>
  );
}
