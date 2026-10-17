/**
 * App header: logo + product name, linking home; *Follow \@fooboarding*
 * (a plain outbound link with the X logo, spec.md C-19); the menu. The logo resolves against
 * Vite's configured base URL, like every other public asset.
 *
 * @module
 */
import { Menu } from 'lucide-react';
import { Link } from 'react-router-dom';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { site } from '@/lib/site';
import { PINNED_FULL } from '@/lib/utils';

import { ExternalLink } from './ExternalLink';

/** The X logo, inline (no X script or widget, C-7). */
function XLogo(): React.JSX.Element {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="size-3.5 fill-current">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const logoUrl = `${import.meta.env.BASE_URL}favicon.svg`;

export function Header(): React.JSX.Element {
  return (
    <header
      className={`${PINNED_FULL} z-40 flex items-center gap-3 border-b border-border bg-primary px-5 py-3 text-primary-foreground`}
    >
      <Link to="/" className="flex items-center gap-2.5 font-bold">
        <img
          src={logoUrl}
          alt=""
          width={26}
          height={26}
          className="rounded-md"
        />
        <span>{site.name}</span>
      </Link>
      <ExternalLink
        unstyled
        href={site.xUrl}
        aria-label={`Follow ${site.xHandle} on X`}
        className="ml-auto flex items-center gap-1.5 rounded-md border border-white/30 px-2 py-1 text-xs hover:bg-white/10"
      >
        <XLogo />
        <span className="hidden sm:inline">Follow {site.xHandle}</span>
      </ExternalLink>
      {/* Non-modal: no scroll lock, so the page scrollbar stays and the
          layout does not shift when the menu opens. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          aria-label="Menu"
          className="rounded-md p-1 hover:bg-white/10"
        >
          <Menu className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to="/demo">Try the demo</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/guide/credentials">Credential guide</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <ExternalLink unstyled href={site.xUrl}>
              News &amp; support on X {site.xHandle}
            </ExternalLink>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <ExternalLink unstyled href={site.issuesUrl}>
              Report an issue
            </ExternalLink>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
