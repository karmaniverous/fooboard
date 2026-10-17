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

import { BoardSummary, BudgetDisplay } from './BoardChrome';
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
  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-2 px-4 py-2">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-base font-semibold">{dashboard.name}</h1>
        {subtitle && (
          <span className="text-xs text-muted-foreground">{subtitle}</span>
        )}
        <BoardSummary model={model} filter={filter} onFilter={setFilter} />
        <div className="ml-auto flex items-center gap-3">
          <BudgetDisplay model={model} />
          {typeof actions === 'function' ? actions(model) : actions}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <BoardViewport
          dashboard={dashboard}
          model={model}
          now={now}
          view={view}
          filter={filter}
        />
      </div>
    </div>
  );
}
