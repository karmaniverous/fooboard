/**
 * App header: logo + product name, linking home. The logo resolves against
 * Vite's configured base URL, like every other public asset.
 *
 * @module
 */
import { Link } from 'react-router-dom';

import { site } from '@/lib/site';

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
    </header>
  );
}
