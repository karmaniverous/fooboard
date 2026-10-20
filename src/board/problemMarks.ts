/**
 * Where the board marks problems (spec.md A§4.3.7): a row header, a stage
 * header, or the dashboard header for dashboard-level ones. Row-group
 * problems mark their rows; column-group problems their stages; cell
 * problems their cell (shown in its detail) and its row; status-set
 * problems the cells using the set (and so their rows), or the dashboard
 * when no cell uses it. Notes are listed, not marked. Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import type { Problem } from '@/domain/problems/problem';
import { statusSetFor } from '@/domain/statuses/resolve';
import { cellKey as keyOf } from '@/engine/types';

export interface ProblemMarks {
  rows: Map<string, Problem[]>;
  stages: Map<string, Problem[]>;
  /** By cell key (the engine's `cellKey`). */
  cells: Map<string, Problem[]>;
  dashboard: Problem[];
}

export function problemMarks(
  dashboard: Dashboard,
  problems: readonly Problem[],
): ProblemMarks {
  const marks: ProblemMarks = {
    rows: new Map(),
    stages: new Map(),
    cells: new Map(),
    dashboard: [],
  };
  const add = (map: Map<string, Problem[]>, id: string, p: Problem) => {
    const list = map.get(id) ?? [];
    if (!list.includes(p)) map.set(id, [...list, p]);
  };
  for (const p of problems) {
    const { level } = p;
    if (p.severity === 'note') continue;
    switch (level.kind) {
      case 'row':
        add(marks.rows, level.id, p);
        break;
      case 'cell':
        add(marks.rows, level.rowId, p);
        add(marks.cells, keyOf(level.rowId, level.stageId), p);
        break;
      case 'stage':
        add(marks.stages, level.id, p);
        break;
      case 'rowGroup':
        for (const id of dashboard.rowGroups.find((g) => g.id === level.id)
          ?.memberIds ?? [])
          add(marks.rows, id, p);
        break;
      case 'columnGroup':
        for (const id of dashboard.columnGroups.find((g) => g.id === level.id)
          ?.memberIds ?? [])
          add(marks.stages, id, p);
        break;
      case 'statusSet': {
        let used = false;
        for (const row of dashboard.rows)
          for (const stage of dashboard.stages)
            if (statusSetFor(dashboard, row, stage.id).id === level.id) {
              used = true;
              add(marks.rows, row.id, p);
              add(marks.cells, keyOf(row.id, stage.id), p);
            }
        if (!used) marks.dashboard.push(p);
        break;
      }
      case 'dashboard':
        marks.dashboard.push(p);
        break;
    }
  }
  return marks;
}
