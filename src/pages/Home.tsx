/**
 * Home page: empty-state placeholder. The real first-run flow (create or
 * import a dashboard, spec.md C-22) lands in a later PR; this scaffold
 * ships only the shell.
 *
 * @module
 */
import { LayoutGrid } from 'lucide-react';

import { Button } from '@/components/ui/button';

export function Home(): React.JSX.Element {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-6 py-24 text-center">
      <LayoutGrid className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="text-xl font-semibold">No dashboards yet</h1>
      <p className="text-sm text-muted-foreground">
        fooboard shows the deployment state of every repo &times; stage at a
        glance, filled in from GitHub Actions runs and Amplify jobs &mdash; no
        workflow changes required. Create a dashboard or import one to get
        started.
      </p>
      <Button disabled>Create a dashboard</Button>
    </div>
  );
}
