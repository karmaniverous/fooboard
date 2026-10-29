/**
 * The not-found screen shared by *Dashboard not found* (spec.md §2.8)
 * and *Page not found* (spec.md §2.16, Scope item 6, row P7): a heading,
 * one line saying why, and a link back to the home page.
 *
 * @module
 */
import { Link } from 'react-router-dom';

/** Where the link back leads: the home page, which lists the dashboards. */
const HOME_PATH = '/';

export function NotFound({
  title,
  message,
}: {
  /** The screen's heading. */
  title: string;
  /** One line saying why there is nothing to show. */
  message: string;
}): React.JSX.Element {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-6 py-24 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{message}</p>
      <Link to={HOME_PATH} className="underline underline-offset-2">
        Back to your dashboards
      </Link>
    </div>
  );
}
