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
import { site } from '@/lib/site';

export function DemoPage(): React.JSX.Element {
  const providers = useMemo(() => demoProviders(), []);
  return (
    <BoardScreen
      dashboard={demoDashboard}
      providers={providers}
      subtitle={`${site.tagline} Sample data: fictional repos, no account needed.`}
    />
  );
}
