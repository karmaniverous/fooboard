/**
 * Home page: empty-state placeholder. The real first-run flow (create or
 * import a dashboard, spec.md C-22) lands in a later PR; this scaffold
 * ships only the shell.
 *
 * @module
 */
import { LayoutGrid } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/buttonVariants';
import { site } from '@/lib/site';
import { useStores } from '@/storage/storesContext';

export function Home(): React.JSX.Element {
  const loaded = useStores().config.load();
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-24 text-center">
      <LayoutGrid className="size-10 text-muted-foreground" aria-hidden />
      <p className="text-lg font-medium">{site.tagline}</p>
      <h1 className="text-xl font-semibold">No dashboards yet</h1>
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
      <div className="flex gap-2">
        <Button disabled>Create a dashboard</Button>
        <Link to="/demo" className={buttonVariants({ variant: 'outline' })}>
          Try the demo
        </Link>
      </div>
    </div>
  );
}
