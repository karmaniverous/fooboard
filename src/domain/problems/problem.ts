/**
 * What a rule problem is (spec.md A§4.3.7 *Rule problems*): where it is
 * marked (its level), what it says, whether it can be dismissed, whether
 * it is a problem or only a note (what the consistency check can't
 * decide, rules for a source no row uses), and the item the editor opens
 * on to fix it. Pure.
 *
 * @module
 */
import type { Provider } from '@/domain/config/providers';

/** Where a problem is marked. */
export type ProblemLevel =
  | { kind: 'dashboard' }
  | { kind: 'rowGroup'; id: string }
  | { kind: 'row'; id: string }
  | { kind: 'columnGroup'; id: string }
  | { kind: 'stage'; id: string }
  | { kind: 'cell'; rowId: string; stageId: string }
  /** Marked on the cells that use the set (their rows' headers). */
  | { kind: 'statusSet'; id: string };

/** The item the editor opens on to fix a problem. */
export type EditTarget =
  | { kind: 'source'; provider: Provider; key?: string }
  | { kind: 'statusSet'; id: string }
  | {
      kind: 'row';
      id: string;
      part?: 'record' | 'items';
      stageId?: string;
    }
  | {
      kind: 'rowGroup';
      id: string;
      part?: 'record' | 'items';
      stageId?: string;
    }
  | { kind: 'stage'; id: string }
  | { kind: 'columnGroup'; id: string }
  | {
      kind: 'dashboard';
      part: 'stageRules' | 'rowRules' | 'itemRules' | 'statusSets';
    };

export interface Problem {
  /** Stable while the problem is the same (for dismissals). */
  id: string;
  level: ProblemLevel;
  message: string;
  dismissable: boolean;
  /** `note`: informational, listed but not marked on the board. */
  severity: 'problem' | 'note';
  /** Where it is fixed; by default, from its level. */
  target?: EditTarget;
}

const levelKey = (l: ProblemLevel): string =>
  l.kind === 'dashboard'
    ? 'dashboard'
    : l.kind === 'cell'
      ? `cell:${l.rowId}:${l.stageId}`
      : `${l.kind}:${l.id}`;

/** A problem at `level`. */
export const problem = (
  level: ProblemLevel,
  message: string,
  dismissable = false,
  extra: { severity?: Problem['severity']; target?: EditTarget } = {},
): Problem => ({
  id: `${levelKey(level)}|${message}`,
  level,
  message,
  dismissable,
  severity: extra.severity ?? 'problem',
  ...(extra.target ? { target: extra.target } : {}),
});

/** A note at `level`: dismissable, not marked on the board. */
export const note = (
  level: ProblemLevel,
  message: string,
  target?: EditTarget,
): Problem => problem(level, message, true, { severity: 'note', target });

/** Where `p` is fixed: its own target, else its level's item. */
export function targetOf(p: Pick<Problem, 'level' | 'target'>): EditTarget {
  if (p.target) return p.target;
  const { level } = p;
  switch (level.kind) {
    case 'dashboard':
      return { kind: 'dashboard', part: 'rowRules' };
    case 'cell':
      return { kind: 'row', id: level.rowId, stageId: level.stageId };
    default:
      return level;
  }
}
