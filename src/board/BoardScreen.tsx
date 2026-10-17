/**
 * A dashboard's board screen: title, summary filters, budget, and the
 * fit/zoom viewport over the live grid. Shared by *Try the demo* and saved
 * dashboards, which differ only in their providers and header extras.
 *
 * @module
 */
import { useState } from 'react';

import type { Dashboard } from '@/domain/config/dashboard';
import type { BoardModel, EngineProviders } from '@/engine';
import { cn, PINNED_X } from '@/lib/utils';

import { BoardSummary, BudgetMeter } from './BoardChrome';
import { BoardViewport } from './BoardViewport';
import type { CellFilter } from './summary';
import { useBoardEngine } from './useBoardEngine';
import { useBoardView } from './useBoardView';

export function BoardScreen({
  dashboard,
  providers,
  subtitle,
  actions,
}: {
  dashboard: Dashboard;
  /** Must be stable between renders; a new object restarts the engine. */
  providers: EngineProviders;
  subtitle?: React.ReactNode;
  /** Extra header controls (credentials, editors, unmapped runs); a
   * function receives the live model. */
  actions?: React.ReactNode | ((model: BoardModel) => React.ReactNode);
}): React.JSX.Element {
  const { model, now } = useBoardEngine(dashboard, providers);
  const view = useBoardView(
    dashboard.id,
    dashboard.rows.length,
    dashboard.stages.length,
  );
  const [filter, setFilter] = useState<CellFilter | null>(null);
  // Wide: title, tagline ... requests. Narrow: title ... requests, then
  // the tagline on its own line (C-13).
  return (
    <div className="flex flex-col gap-2 px-4 py-2">
      <div className={cn('@container', PINNED_X)}>
        <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-3 gap-y-0.5 @min-[60rem]:grid-cols-[auto_1fr_auto]">
          <h1 className="order-1 text-base font-semibold">{dashboard.name}</h1>
          <div className="order-2 flex items-center gap-3 self-center justify-self-end @min-[60rem]:order-3">
            <BudgetMeter model={model} />
            {typeof actions === 'function' ? actions(model) : actions}
          </div>
          {subtitle && (
            <span className="order-3 col-span-2 text-xs text-muted-foreground @min-[60rem]:order-2 @min-[60rem]:col-span-1">
              {subtitle}
            </span>
          )}
        </div>
      </div>
      <div>
        <BoardViewport
          dashboard={dashboard}
          model={model}
          now={now}
          view={view}
          filter={filter}
          lead={
            <BoardSummary model={model} filter={filter} onFilter={setFilter} />
          }
        />
      </div>
    </div>
  );
}
