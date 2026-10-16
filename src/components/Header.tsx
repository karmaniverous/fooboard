/**
 * App header: logo + product name, linking home.
 *
 * @module
 */
import { Link } from 'react-router-dom';

export function Header(): React.JSX.Element {
  return (
    <header className="flex items-center gap-3 border-b border-border bg-primary px-5 py-3 text-primary-foreground">
      <Link to="/" className="flex items-center gap-2.5 font-bold">
        <img
          src="/favicon.svg"
          alt=""
          width={26}
          height={26}
          className="rounded-md"
        />
        <span>fooboard</span>
      </Link>
    </header>
  );
}
