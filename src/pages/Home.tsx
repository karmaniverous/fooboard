/**
 * Home page: the saved dashboards (or a note that they can't be read,
 * with *Reset* to start again, spec.md §3.9), creating or importing a
 * dashboard (spec.md §3.8), and the demo. The first-run flow (N7) comes
 * later. A share link's import dialog opens over this page.
 *
 * @module
 */
import { Link } from 'react-router-dom';

import { useNavDialogs } from '@/components/navItems';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/buttonVariants';
import { CreateDashboard } from '@/editors/CreateDashboard';
import { site } from '@/lib/site';
import { dashboardsOf } from '@/storage/configStore';
import { useStores } from '@/storage/storesContext';

export function Home(): React.JSX.Element {
  const loaded = useStores().config.load();
  const dashboards = dashboardsOf(loaded);
  const { openReset, openImport } = useNavDialogs();
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-xl flex-col items-center gap-4 px-6 py-24 text-center">
      <img
        src={site.logoUrl}
        alt=""
        width={96}
        height={96}
        className="size-24 rounded-2xl"
      />
      <p className="text-lg font-medium">{site.tagline}</p>
      <h1 className="text-xl font-semibold">
        {dashboards.length === 0 ? 'No dashboards yet' : 'Your dashboards'}
      </h1>
      {dashboards.length > 0 && (
        <ul className="flex w-full flex-col gap-1 text-left">
          {dashboards.map((d) => (
            <li key={d.id}>
              <Link
                to={`/d/${d.id}`}
                className="block rounded-md border px-3 py-2 hover:bg-muted"
              >
                {d.name}
                <span className="ml-2 text-xs text-muted-foreground">
                  {d.rows.length} rows &times; {d.stages.length} stages
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {loaded.kind === 'unreadable' && (
        <>
          <p role="alert" className="text-sm text-status-failure">
            Saved dashboards can't be read ({loaded.reason}). They have not been
            changed. To start again, reset fooboard: that removes all of its
            data from this browser.
          </p>
          <Button size="sm" variant="outline" onClick={openReset}>
            Reset…
          </Button>
        </>
      )}
      <p className="text-sm text-muted-foreground">
        fooboard shows the deployment state of every repo &times; stage at a
        glance, filled in from GitHub Actions runs and Amplify jobs &mdash; no
        workflow changes required. Create a dashboard or import one to get
        started.
      </p>
      {loaded.kind === 'ok' && (
        <>
          <CreateDashboard />
          <Button variant="outline" onClick={openImport}>
            Import from a file…
          </Button>
        </>
      )}
      <Link to="/demo" className={buttonVariants({ variant: 'outline' })}>
        Try the demo
      </Link>
    </div>
  );
}
