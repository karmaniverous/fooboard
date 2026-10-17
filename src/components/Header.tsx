/**
 * App header: logo + product name, linking home. The logo resolves against
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

import { ExternalLink } from './ExternalLink';

const logoUrl = `${import.meta.env.BASE_URL}favicon.svg`;

export function Header(): React.JSX.Element {
  return (
    <header className="flex items-center gap-3 border-b border-border bg-primary px-5 py-3 text-primary-foreground">
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
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Menu"
          className="ml-auto rounded-md p-1 hover:bg-white/10"
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
