/**
 * *Try the demo* (spec.md C-23): the fictional `acme/*` board, driven by
 * the bundled demo providers, so visitors see fooboard before creating a
 * token. Only the view settings (zoom, row height) are saved, per device.
 * In development, `?latency=300` delays every demo request (spec.md §3.5).
 *
 * @module
 */
import { useMemo } from 'react';

import { BoardScreen } from '@/board/BoardScreen';
import { demoDashboard } from '@/demo/board';
import { demoProviders } from '@/engine';
import { withDemoLatency } from '@/perf';

export function DemoPage(): React.JSX.Element {
  const providers = useMemo(() => withDemoLatency(demoProviders()), []);
  return <BoardScreen dashboard={demoDashboard} providers={providers} />;
}
