/**
 * *Try the demo* (spec.md §3.14, Decisions 53 and 54): fooboard's real
 * board, panels and editors over a simulated GitHub and AWS, so visitors
 * see it work before creating a token. The readers send through the
 * simulator's transport and read the scenario's world at the clock's
 * time; nothing leaves the browser. The visit has its own query
 * environment (never persisted) and its own stores for the dashboard and
 * its credentials, in memory for the tab: every edit, from the board's
 * gears or the dashboard editor, changes this visit's copy only, gone on
 * reload or on leaving the demo; only the view settings (zoom, row
 * height) are saved, per device. Its settings popup offers *Open in
 * dashboard settings* like any board's (§3.11 *Demo*). In development,
 * `?latency=300` delays every response and `?scenario=measure` plays the
 * measurement scenario (§3.5).
 *
 * @module
 */
import { useEffect, useState } from 'react';

import { demoPreferences } from '@/demo/demoPreferences';
import { createDemoSession } from '@/demo/demoSession';
import { InDemoContext } from '@/demo/inDemo';
import { demoScenarioFor } from '@/demo/scenarioChoice';
import type { DemoScenario } from '@/demo/sim/scenario';
import { demoLatency } from '@/perf';
import { QueryProvider } from '@/query/QueryProvider';
import { createConfigStore } from '@/storage/configStore';
import { memoryStorage } from '@/storage/keyValue';
import { StoresContext, useStores } from '@/storage/storesContext';

import { DashboardView } from './DashboardView';

/** Discard an edited demo dashboard: the view keeps it for the visit. */
const keepInMemory = (): void => undefined;

function DemoVisit({
  scenario,
}: {
  scenario: DemoScenario;
}): React.JSX.Element {
  const stores = useStores();
  const [visit] = useState(() => {
    const session = createDemoSession(scenario, { latencyMs: demoLatency() });
    return {
      env: session.env,
      // View settings on the device; the rest, dismissals too, in memory.
      stores: {
        ...stores,
        config: createConfigStore(memoryStorage()),
        credentials: session.credentials,
        preferences: demoPreferences(stores.preferences),
      },
    };
  });
  return (
    <InDemoContext value>
      <StoresContext value={visit.stores}>
        <QueryProvider env={visit.env}>
          <DashboardView
            initial={scenario.dashboard}
            others={[]}
            onSave={keepInMemory}
          />
        </QueryProvider>
      </StoresContext>
    </InDemoContext>
  );
}

/** The scenario this URL plays: the shipped one at once, the
 * measurement one (development) once loaded. */
function useDemoScenario(): DemoScenario | undefined {
  const [found] = useState(() => demoScenarioFor(window.location.search));
  const [loaded, setLoaded] = useState(() =>
    found instanceof Promise ? undefined : found,
  );
  useEffect(() => {
    // A failed load (development only) throws as the next render, for the
    // error boundary, as any render error does.
    if (found instanceof Promise)
      found.then(setLoaded, (err: unknown) => {
        setLoaded(() => {
          throw err;
        });
      });
  }, [found]);
  return loaded;
}

export function DemoPage(): React.JSX.Element {
  const scenario = useDemoScenario();
  return scenario ? <DemoVisit scenario={scenario} /> : <p>Loading…</p>;
}
