/**
 * A dashboard's board screen: title, summary filters, budget, and the
 * fit/zoom viewport over the live grid. Shared by *Try the demo* and saved
 * dashboards, which differ only in their providers and header extras.
 *
 * @module
 */
import { useState } from 'react';

import { ShareButton } from '@/components/ShareButton';
import type { Dashboard } from '@/domain/config/dashboard';
import type { BoardModel, EngineProviders } from '@/engine';
import { measuredWidth, useMeasured } from '@/lib/useMeasured';
import { cn, PINNED_X } from '@/lib/utils';

import { BoardSummary, BudgetMeter } from './BoardChrome';
import { BoardViewport } from './BoardViewport';
import type { CellFilter } from './summary';
import { useBoardEngine } from './useBoardEngine';
import { useBoardView } from './useBoardView';

/** `gap-x-3` in px. */
const HEADER_GAP_PX = 12;

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
  // Wide (title, tagline and requests fit one line): title, tagline ...
  // requests. Otherwise title ... requests, then the tagline below. Chosen
  // by measuring the content (C-13).
  const [header, wide] = useMeasured<HTMLDivElement, boolean>(
    (el) =>
      measuredWidth(el, 'title') +
        measuredWidth(el, 'tagline') +
        measuredWidth(el, 'end') +
        2 * HEADER_GAP_PX <=
      el.clientWidth,
    true,
  );
  return (
    <div className="flex flex-col gap-2 px-4 py-2">
      <div ref={header} className={cn('relative', PINNED_X)}>
        <div
          aria-hidden
          inert
          className="invisible absolute left-0 top-0 flex w-max whitespace-nowrap"
        >
          <span data-measure="title" className="text-base font-semibold">
            {dashboard.name}
          </span>
          {subtitle && (
            <span data-measure="tagline" className="text-xs">
              {subtitle}
            </span>
          )}
        </div>
        <div
          className={cn(
            'grid items-baseline gap-x-3 gap-y-0.5',
            wide ? 'grid-cols-[auto_1fr_auto]' : 'grid-cols-[1fr_auto]',
          )}
        >
          <h1 className="order-1 text-base font-semibold">{dashboard.name}</h1>
          <div
            data-measure="end"
            className={cn(
              'flex items-center gap-3 self-center justify-self-end',
              wide ? 'order-3' : 'order-2',
            )}
          >
            <BudgetMeter model={model} />
            <ShareButton />
            {typeof actions === 'function' ? actions(model) : actions}
          </div>
          {subtitle && (
            <span
              className={cn(
                'text-xs text-muted-foreground',
                wide ? 'order-2' : 'order-3 col-span-2',
              )}
            >
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
          lead={({ words }) => (
            <BoardSummary
              model={model}
              filter={filter}
              onFilter={setFilter}
              words={words}
            />
          )}
        />
      </div>
    </div>
  );
}
