/**
 * A saved dashboard (spec.md §2.4): its board and panels
 * (`DashboardView`) read with this dashboard's credentials through the
 * app's query environment, every edit saved to this browser. The board
 * waits for the persisted cache to be restored, then shows it at once
 * (§3.4). A changed secret removes what was read with the old one
 * (`appQueryEnv`). Opened at the end of the first run, the board is its
 * last step (§3.9, `FirstRunNote`).
 *
 * @module
 */
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { isFirstRunState } from '@/firstRun/paths';
import { QueryProvider } from '@/query/QueryProvider';
import { dashboardsOf } from '@/storage/configStore';
import { useStores } from '@/storage/storesContext';

import { DashboardNotFound } from './DashboardNotFound';
import { DashboardView } from './DashboardView';
import { useAppQueryEnv } from './useAppQueryEnv';

export function DashboardPage(): React.JSX.Element {
  const { id } = useParams();
  const stores = useStores();
  const loaded = stores.config.load();
  const dashboards = dashboardsOf(loaded);
  const dashboard = dashboards.find((d) => d.id === id);
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname } = location;
  const state: unknown = location.state;
  // Last: it may suspend until the cache is restored (`use`).
  const env = useAppQueryEnv();
  if (!dashboard) return <DashboardNotFound />;
  return (
    <QueryProvider env={env}>
      <DashboardView
        key={dashboard.id}
        initial={dashboard}
        others={dashboards.filter((d) => d.id !== dashboard.id)}
        firstRun={isFirstRunState(state)}
        onFirstRunDone={() => {
          // A reload or Back no longer reopens the note.
          navigate(pathname, { replace: true, state: null });
        }}
        onSave={(next) => {
          stores.config.saveDashboard(next);
        }}
      />
    </QueryProvider>
  );
}
