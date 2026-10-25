/**
 * What a rule problem is (spec.md A§4.3.7 *Rule problems*): where it is
 * marked (its level), what it says, whether it can be dismissed, whether
 * it is a problem or only a note (what the consistency check can't
 * decide, rules for a source no row uses), the item the editor opens
 * on to fix it, and any one-click actions it offers (*Pin* and *Unpin*,
 * spec.md §3.12). Pure.
 *
 * @module
 */
import type { Provider } from '@/domain/config/providers';
import type { PinChange } from '@/domain/settings/pins';
import type { SettingsPlace } from '@/domain/settings/places';
import type { SettingField } from '@/domain/settings/schema';

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
      /** `pinnedApps`: an Amplify row's pinned apps (spec.md §3.12). */
      part?: 'record' | 'pinnedApps';
      stageId?: string;
    }
  | {
      kind: 'rowGroup';
      id: string;
      part?: 'record';
      stageId?: string;
    }
  | { kind: 'stage'; id: string }
  | { kind: 'columnGroup'; id: string }
  | { kind: 'dashboard'; part: 'stageRules' | 'rowRules' }
  /** A field of the settings at a place (spec.md §3.11); `source` for a
   * per-source field. */
  | {
      kind: 'settings';
      place: SettingsPlace;
      field: SettingField;
      source?: Provider;
    };

/** A one-click change a problem offers: pin an app to an Amplify row, or
 * unpin one (spec.md §3.12). */
export interface ProblemAction extends PinChange {
  /** The button's text. */
  label: string;
}

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
  actions?: ProblemAction[];
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
  extra: {
    severity?: Problem['severity'];
    target?: EditTarget;
    actions?: ProblemAction[];
  } = {},
): Problem => ({
  id: `${levelKey(level)}|${message}`,
  level,
  message,
  dismissable,
  severity: extra.severity ?? 'problem',
  ...(extra.target ? { target: extra.target } : {}),
  ...(extra.actions ? { actions: extra.actions } : {}),
});

/** A note at `level`: dismissable, not marked on the board. */
export const note = (
  level: ProblemLevel,
  message: string,
  target?: EditTarget,
  actions?: ProblemAction[],
): Problem =>
  problem(level, message, true, { severity: 'note', target, actions });

/** The level a problem with the settings at `place` is marked at. */
export function levelOfPlace(place: SettingsPlace): ProblemLevel {
  switch (place.level) {
    case 'dashboard':
      return { kind: 'dashboard' };
    case 'rowGroup':
    case 'columnGroup':
      return { kind: place.level, id: place.groupId };
    case 'row':
      return { kind: 'row', id: place.rowId };
    case 'column':
      return { kind: 'stage', id: place.stageId };
    case 'cell':
      return { kind: 'cell', rowId: place.rowId, stageId: place.stageId };
  }
}

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
