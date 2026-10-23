/**
 * *Try the demo* (spec.md C-23): the fictional `acme/*` board, driven by
 * the bundled demo providers through its own query environment, never
 * persisted, so visitors see fooboard before creating a token. Creating
 * the environment has no side effects; it listens for focus and
 * reconnects only while its `QueryProvider` is mounted. Only the
 * view settings (zoom, row height) are saved, per device. In development,
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
  return (
    <QueryProvider env={env}>
      <BoardScreen dashboard={demoDashboard} around={around} />
    </QueryProvider>
  );
}
