/**
 * What every box on the board shows at each detail rung (spec.md C-13),
 * for worst-case sizing. Fixed-form fields are given at their longest form
 * (status label, relative time, short commit, phase, badge), so polling
 * cannot change the layout through them; free text (branches, commit
 * messages, stage names, group labels) is taken as it is, capped. Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import type { BoardModel } from '@/engine';

import { EMPTY_LABEL, STATUS_META } from './cellView';
import { columnGroups } from './columnGroups';
import { capText, type Content, type Rung } from './layout';

/** Longest forms of the fixed fields. */
const LONGEST = {
  status: Object.values(STATUS_META).reduce(
    (a, m) => (m.label.length > a.length ? m.label : a),
    '',
  ),
  time: '59m',
  commit: '0000000',
  phase: 'deploy',
  badge: '99/99',
} as const;

/** The first line of a commit message. */
export const firstLine = (message: string): string =>
  message.split('\n', 1)[0]?.trim() ?? '';

/** Build the per-rung contents for a board. */
export function boardContents(
  dashboard: Pick<Dashboard, 'stages' | 'columnDividers'>,
  model: Pick<BoardModel, 'cells'>,
): (rung: Rung) => Content[] {
  const anyBadge = Object.values(model.cells).some((c) => c?.badge);
  const groups = columnGroups(
    dashboard.stages,
    new Map(dashboard.columnDividers.map((d) => [d.beforeId, d])),
  );
  const headers: Content[] = [
    ...dashboard.stages.map((s) => ({ lead: capText(s.name), rest: [] })),
    ...groups
      .filter((g) => g.label)
      .map((g) => ({ lead: capText(g.label), rest: [] })),
  ];
  const lead = `\u2298 ${LONGEST.status}`;
  return (rung) => {
    const out = [...headers];
    for (const cell of Object.values(model.cells)) {
      if (!cell) continue;
      const d = cell.derivation;
      if (d.kind === 'empty') {
        const extra = d.reason ?? d.branch;
        out.push({
          lead: EMPTY_LABEL[d.state],
          rest: [],
          free: rung >= 4 && extra ? [capText(extra)] : [],
        });
        continue;
      }
      const rest: string[] = [];
      const free: string[] = [];
      if (rung >= 2) rest.push(LONGEST.time);
      if (rung >= 3) rest.push(LONGEST.commit, LONGEST.phase);
      if (rung >= 4 && d.branch) free.push(capText(d.branch));
      if (rung >= 5 && d.message) free.push(capText(firstLine(d.message)));
      out.push({
        lead,
        badge: anyBadge ? LONGEST.badge : undefined,
        rest,
        free,
      });
    }
    return out;
  };
}
