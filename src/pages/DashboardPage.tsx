/**
 * A saved dashboard (spec.md §2.4): its board and panels
 * (`DashboardView`) read with this dashboard's credentials through the
 * app's query environment, every edit saved to this browser. The board
 * waits for the persisted cache to be restored, then shows it at once
 * (§3.4). A changed secret removes what was read with the old one
 * (`appQueryEnv`).
 *
 * @module
 */
import { use } from 'react';
import { Link, useParams } from 'react-router-dom';

import { appQueryEnv } from '@/engine/appEnv';
import { QueryProvider } from '@/query/QueryProvider';
import { dashboardsOf } from '@/storage/configStore';
import { useStores } from '@/storage/storesContext';

import { DashboardView } from './DashboardView';

export function DashboardPage(): React.JSX.Element {
  const { id } = useParams();
  const stores = useStores();
  const loaded = stores.config.load();
  const dashboards = dashboardsOf(loaded);
  const dashboard = dashboards.find((d) => d.id === id);
  const env = appQueryEnv(stores);
  // The cached board shows once restored (the app's Suspense waits).
  if (!env.isRestored()) use(env.restored);
  if (!dashboard) {
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
  return (
    <QueryProvider env={env}>
      <DashboardView
        key={dashboard.id}
        initial={dashboard}
        others={dashboards.filter((d) => d.id !== dashboard.id)}
        env={env}
        onSave={(next) => {
          stores.config.saveDashboard(next);
        }}
      />
    </QueryProvider>
  );
}
