/**
 * A dashboard's board screen: title, summary filters, budget, and the
 * fit/zoom viewport over the live grid. Shared by *Try the demo* and saved
 * dashboards, which differ only in their query environment, header
 * extras and where settings edits go (spec.md §3.11: saved, or the demo's
 * in-memory copy).
 *
 * @module
 */

import type { Dashboard } from '@/domain/config/dashboard';
import type { Problem } from '@/domain/problems/problem';
import type { BoardModel } from '@/engine';
import { cn, PINNED_X } from '@/lib/utils';
import type { Around } from '@/query/instrument';
import { useQueryEnv } from '@/query/queryEnvContext';

import { BoardSummary, BudgetMeter } from './BoardChrome';
import { BoardViewport } from './BoardViewport';
import { ProblemMark } from './ProblemMark';
import { problemMarks } from './problemMarks';
import { ProblemMarksContext } from './problemMarksContext';
import {
  type SettingsPopupActions,
  SettingsPopupProvider,
} from './SettingsPopup';
import { StatusLegend } from './StatusLegend';
import { useCellFilter } from './summary';
import { useBoardModel } from './useBoardModel';
import { useBoardView } from './useBoardView';
import { type BoardProblems, useProblems } from './useProblems';

export function BoardScreen({
  dashboard,
  around,
  refreshKey,
  actions,
  onOpenProblem,
  onChange,
  onOpenSettings,
}: SettingsPopupActions & {
  dashboard: Dashboard;
  /** Wraps every request (the demo's simulated latency); keep stable. */
  around?: Around;
  /** A new value re-derives every row (a secret changed). */
  refreshKey?: unknown;
  /** Extra header controls (credentials, editors, unmapped runs); a
   * function receives the live model. */
  actions?:
    | React.ReactNode
    | ((model: BoardModel, problems: BoardProblems) => React.ReactNode);
  /** Open the editor at a problem (clicking a marker); none in the demo. */
  onOpenProblem?: (problem: Problem) => void;
}): React.JSX.Element {
  const { model, now } = useBoardModel(dashboard, useQueryEnv(), {
    around,
    refreshKey,
  });
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
        <SettingsPopupProvider
          dashboard={dashboard}
          onChange={onChange}
          onOpenSettings={onOpenSettings}
        >
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
        </SettingsPopupProvider>
      </ProblemMarksContext>
    </div>
  );
}
