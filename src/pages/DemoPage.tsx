/**
 * *Try the demo* (spec.md C-23): the fictional `acme/*` board, driven by
 * the bundled demo providers, so visitors see fooboard before creating a
 * token. Nothing is stored and nothing leaves the browser.
 *
 * @module
 */
import { useMemo } from 'react';

import { BoardGrid } from '@/board/BoardGrid';
import { useBoardEngine } from '@/board/useBoardEngine';
import { demoDashboard } from '@/demo/board';
import { demoProviders } from '@/engine';

export function DemoPage(): React.JSX.Element {
  const providers = useMemo(() => demoProviders(), []);
  const { model, now } = useBoardEngine(demoDashboard, providers);
  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-2 px-4 py-2">
      <div className="flex items-baseline gap-3">
        <h1 className="text-base font-semibold">{demoDashboard.name}</h1>
        <span className="text-xs text-muted-foreground">
          Sample data: fictional repos, no account needed.
        </span>
      </div>
      <div className="min-h-0 flex-1">
        <BoardGrid
          dashboard={demoDashboard}
          model={model}
          rowHeight="compact"
          now={now}
        />
      </div>
    </div>
  );
}
