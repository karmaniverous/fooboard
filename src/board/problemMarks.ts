/**
 * Where the board marks problems (spec.md A§4.3.7): a row header, a stage
 * header, or the whole board for dashboard-level ones. Row-group problems
 * mark their rows; column-group problems their stages; cell problems
 * their row. Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import type { Problem } from '@/domain/problems/problem';

export interface ProblemMarks {
  rows: Map<string, string[]>;
  stages: Map<string, string[]>;
}

export function problemMarks(
  dashboard: Pick<Dashboard, 'rowGroups' | 'columnGroups'>,
  problems: readonly Problem[],
): ProblemMarks {
  const rows = new Map<string, string[]>();
  const stages = new Map<string, string[]>();
  const add = (map: Map<string, string[]>, id: string, message: string) => {
    map.set(id, [...(map.get(id) ?? []), message]);
  };
  for (const { level, message, severity } of problems) {
    if (severity === 'note') continue;
    switch (level.kind) {
      case 'row':
        add(rows, level.id, message);
        break;
      case 'cell':
        add(rows, level.rowId, message);
        break;
      case 'stage':
        add(stages, level.id, message);
        break;
      case 'rowGroup':
        for (const id of dashboard.rowGroups.find((g) => g.id === level.id)
          ?.memberIds ?? [])
          add(rows, id, message);
        break;
      case 'columnGroup':
        for (const id of dashboard.columnGroups.find((g) => g.id === level.id)
          ?.memberIds ?? [])
          add(stages, id, message);
        break;
      case 'dashboard':
      case 'statusSet':
        break;
    }
  }
  return { rows, stages };
}
