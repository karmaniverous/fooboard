/**
 * A dashboard's board screen: title, summary filters, budget, and the
 * fit/zoom viewport over the live grid. Shared by *Try the demo* and saved
 * dashboards, which differ only in their providers and header extras.
 *
 * @module
 */

import type { Dashboard } from '@/domain/config/dashboard';
import type { Problem } from '@/domain/problems/problem';
import type { BoardModel, EngineProviders } from '@/engine';
import { cn, PINNED_X } from '@/lib/utils';

import { BoardSummary, BudgetMeter } from './BoardChrome';
import { BoardViewport } from './BoardViewport';
import { ProblemMark } from './ProblemMark';
import { problemMarks } from './problemMarks';
import { ProblemMarksContext } from './problemMarksContext';
import { StatusLegend } from './StatusLegend';
import { useCellFilter } from './summary';
import { useBoardEngine } from './useBoardEngine';
import { useBoardView } from './useBoardView';
import { type BoardProblems, useProblems } from './useProblems';

export function BoardScreen({
  dashboard,
  providers,
  actions,
  onOpenProblem,
}: {
  dashboard: Dashboard;
  /** Must be stable between renders; a new object restarts the engine. */
  providers: EngineProviders;
  /** Extra header controls (credentials, editors, unmapped runs); a
   * function receives the live model. */
  actions?:
    | React.ReactNode
    | ((model: BoardModel, problems: BoardProblems) => React.ReactNode);
  /** Open the editor at a problem (clicking a marker); none in the demo. */
  onOpenProblem?: (problem: Problem) => void;
}): React.JSX.Element {
  const { model, now } = useBoardEngine(dashboard, providers);
  const view = useBoardView(
    dashboard.id,
    dashboard.rows.length,
    dashboard.stages.length,
  );
  const [filter, setFilter] = useCellFilter(model);
  const problems = useProblems(dashboard, model);
  const marks = {
    ...problemMarks(dashboard, problems.shown),
    onOpen: onOpenProblem,
  };
  return (
    <div className="flex flex-col gap-2 px-4 py-2">
      {/* Title at the left, requests and controls at the right; the
          tagline lives in the app header (C-19). */}
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-x-3 gap-y-1',
          PINNED_X,
        )}
      >
        <ProblemMarksContext value={marks}>
          <h1 className="flex items-center text-base font-semibold">
            {dashboard.name}
            <ProblemMark problems={marks.dashboard} />
          </h1>
        </ProblemMarksContext>
        <div className="flex items-center gap-3">
          <StatusLegend dashboard={dashboard} />
          <BudgetMeter
            model={model}
            labels={Object.fromEntries(
              dashboard.credentials.map((c) => [c.id, c.label]),
            )}
          />
          {typeof actions === 'function' ? actions(model, problems) : actions}
        </div>
      </div>
      <ProblemMarksContext value={marks}>
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
      </ProblemMarksContext>
    </div>
  );
}
