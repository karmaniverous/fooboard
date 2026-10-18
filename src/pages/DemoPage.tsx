/**
 * *Try the demo* (spec.md C-23): the fictional `acme/*` board, driven by
 * the bundled demo providers, so visitors see fooboard before creating a
 * token. Only the view settings (zoom, row height) are saved, per device.
 *
 * @module
 */
import { useMemo } from 'react';

import { BoardScreen } from '@/board/BoardScreen';
import { demoDashboard } from '@/demo/board';
import { demoProviders } from '@/engine';

export function DemoPage(): React.JSX.Element {
  const providers = useMemo(() => demoProviders(), []);
  return <BoardScreen dashboard={demoDashboard} providers={providers} />;
}
