/**
 * A saved dashboard (spec.md §2.4): its board and panels
 * (`DashboardView`) read with this dashboard's credentials through the
 * app's query environment, every edit saved to this browser. The board
 * waits for the persisted cache to be restored, then shows it at once
 * (§3.4). A changed secret removes what was read with the old one
 * (`appQueryEnv`). Opened at the end of the first run, the board is its
 * last step (§3.9, `FirstRunNote`). Every import that lands here opens
 * the board afresh on the imported dashboard, even when it replaced the
 * one already open, so the next edit can't save the old one over it; one
 * that asks for a credential's secret opens the credentials panel on it,
 * once (spec 0.2.0 §3.J *Keys on arrival*). Each arrival is its
 * navigation's `location.key`, and the view is keyed by it, so clearing
 * the arrival's state (another navigation) keeps the view.
 *
 * @module
 */
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { importArrivalOf, isFirstRunState } from '@/firstRun/paths';
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
  const imported = importArrivalOf(state);
  const openCredential = imported?.openCredential;
  // The import that last landed here: a new one remounts the view on the
  // imported dashboard, whether or not it asks for a key.
  const landing = imported === undefined ? undefined : location.key;
  const [arrival, setArrival] = useState(landing);
  if (landing !== undefined && landing !== arrival) setArrival(landing);
  // Once: a reload or Back no longer reopens the panel.
  const arrived = imported !== undefined;
  useEffect(() => {
    if (arrived) navigate(pathname, { replace: true, state: null });
  }, [arrived, navigate, pathname]);
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
