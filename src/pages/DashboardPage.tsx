/**
 * A saved dashboard (spec.md §2.4): its board and panels
 * (`DashboardView`) read with this dashboard's credentials through the
 * app's query environment, every edit saved to this browser. The board
 * waits for the persisted cache to be restored, then shows it at once
 * (§3.4). A changed secret removes what was read with the old one
 * (`appQueryEnv`). Opened at the end of the first run, the board is its
 * last step (§3.9, `FirstRunNote`). Opened after an import to ask for a
 * credential's secret, its credentials panel opens on it, once (spec
 * 0.2.0 §3.J *Keys on arrival*), even when the import replaced the
 * dashboard already open here: each such arrival opens the board afresh.
 * Each arrival is its navigation's `location.key`, and the view is keyed
 * by it, so clearing the request (another navigation) keeps the view.
 *
 * @module
 */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { isFirstRunState, openCredentialOf } from '@/firstRun/paths';
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
  const openCredential = openCredentialOf(state);
  // The navigation that last asked for a credential: a new one (an import
  // landing here again) remounts the view on the imported dashboard.
  const asking = openCredential === undefined ? undefined : location.key;
  const [arrival, setArrival] = useState(asking);
  if (asking !== undefined && asking !== arrival) setArrival(asking);
  // Asked once: a reload or Back no longer reopens the panel.
  useEffect(() => {
    if (openCredential !== undefined)
      navigate(pathname, { replace: true, state: null });
  }, [openCredential, navigate, pathname]);
  // Last: it may suspend until the cache is restored (`use`).
  const env = useAppQueryEnv();
  if (!dashboard) return <DashboardNotFound />;
  return (
    <QueryProvider env={env}>
      <DashboardView
        key={`${dashboard.id}:${arrival ?? ''}`}
        initial={dashboard}
        others={dashboards.filter((d) => d.id !== dashboard.id)}
        firstRun={isFirstRunState(state)}
        openCredential={openCredential}
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
