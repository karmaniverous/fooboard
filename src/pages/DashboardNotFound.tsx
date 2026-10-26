/**
 * What a page for a dashboard this browser doesn't hold shows: the board
 * (spec.md §2.4) and the first run's later steps (§3.9).
 *
 * @module
 */
import { Link } from 'react-router-dom';

export function DashboardNotFound(): React.JSX.Element {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-3 px-6 py-24 text-center">
      <h1 className="text-xl font-semibold">Dashboard not found</h1>
      <p className="text-sm text-muted-foreground">
        It isn&apos;t saved in this browser.
      </p>
      <Link to="/" className="underline underline-offset-2">
        Back to your dashboards
      </Link>
    </div>
  );
}
