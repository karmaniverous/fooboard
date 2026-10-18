/**
 * Home page: empty-state placeholder. The real first-run flow (create or
 * import a dashboard, spec.md C-22) lands in a later PR; this scaffold
 * ships only the shell.
 *
 * @module
 */
import { Link } from 'react-router-dom';

import { buttonVariants } from '@/components/ui/buttonVariants';
import { CreateDashboard } from '@/editors/CreateDashboard';
import { site } from '@/lib/site';
import { dashboardsOf } from '@/storage/configStore';
import { useStores } from '@/storage/storesContext';

export function Home(): React.JSX.Element {
  const loaded = useStores().config.load();
  const dashboards = dashboardsOf(loaded);
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-xl flex-col items-center gap-4 px-6 py-24 text-center">
      <img
        src={`${import.meta.env.BASE_URL}favicon.svg`}
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
        <p role="alert" className="text-sm text-status-failure">
          Saved dashboards can't be read ({loaded.reason}). They have not been
          changed.
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        fooboard shows the deployment state of every repo &times; stage at a
        glance, filled in from GitHub Actions runs and Amplify jobs &mdash; no
        workflow changes required. Create a dashboard or import one to get
        started.
      </p>
      {loaded.kind === 'ok' && <CreateDashboard />}
      <Link to="/demo" className={buttonVariants({ variant: 'outline' })}>
        Try the demo
      </Link>
    </div>
  );
}
