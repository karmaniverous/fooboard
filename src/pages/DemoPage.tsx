/**
 * *Try the demo* (spec.md C-23): the fictional `acme/*` board, driven by
 * the bundled demo providers through its own query environment, never
 * persisted, so visitors see fooboard before creating a token. Creating
 * the environment has no side effects; it listens for focus and
 * reconnects only while its `QueryProvider` is mounted. Only the
 * view settings (zoom, row height) are saved, per device. Settings edits
 * from the board's gears change an in-memory copy of the demo dashboard
 * for this visit only: never saved, gone on reload or on leaving the demo
 * (spec.md §3.11 *Demo*). Until the demo has a dashboard editor (N3b),
 * its settings popup has no *Open in dashboard settings*. In development,
 * `?latency=300` delays every demo request (spec.md §3.5).
 *
 * @module
 */
import { useState } from 'react';

import { BoardScreen } from '@/board/BoardScreen';
import { demoDashboard } from '@/demo/board';
import { demoProviders } from '@/engine';
import { demoLatency } from '@/perf';
import { createQueryEnv } from '@/query/client';
import { QueryProvider } from '@/query/QueryProvider';

export function DemoPage(): React.JSX.Element {
  const [env] = useState(() =>
    createQueryEnv({ providers: (hooks) => demoProviders(hooks) }),
  );
  const [around] = useState(demoLatency);
  const [dashboard, setDashboard] = useState(demoDashboard);
  return (
    <QueryProvider env={env}>
      <BoardScreen
        dashboard={dashboard}
        around={around}
        onChange={setDashboard}
      />
    </QueryProvider>
  );
}
