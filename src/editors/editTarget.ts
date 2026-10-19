/**
 * Where the editor opens to fix something (spec.md A§4.3.7 *Rule
 * problems*: the warning marker "opens the editor at the problem"): the
 * tab an edit target lives on, and the keys of the editor items to open
 * and scroll to, most specific first. Editor items carry their key in
 * `data-edit-target`; an item whose key is a prefix of the focus (up to
 * a `:`) opens so the focused item inside it shows. Pure, except the
 * context.
 *
 * @module
 */
import { createContext, useContext } from 'react';

import type { EditTarget } from '@/domain/problems/problem';
import type { Check } from '@/domain/rules/schema';

export const EDITOR_TABS = [
  'General',
  'Rows',
  'Stages',
  'Sources',
  'Statuses',
] as const;
export type EditorTab = (typeof EDITOR_TABS)[number];

/** The editor items to open, most specific first. */
export function focusKeys(t: EditTarget): string[] {
  switch (t.kind) {
    case 'source':
      return [
        ...(t.key === undefined ? [] : [`source:${t.provider}:key:${t.key}`]),
        `source:${t.provider}`,
        `source-choice:${t.provider}`,
      ];
    case 'statusSet':
      return [`statusSet:${t.id}`, 'dashboard:statusSets'];
    case 'row':
    case 'rowGroup':
      return [
        ...(t.part === undefined ? [] : [`${t.kind}:${t.id}:${t.part}`]),
        ...(t.stageId === undefined
          ? []
          : [`${t.kind}:${t.id}:stage:${t.stageId}`]),
        `${t.kind}:${t.id}`,
      ];
    case 'stage':
    case 'columnGroup':
      return [`${t.kind}:${t.id}:rules`, `${t.kind}:${t.id}`];
    case 'dashboard':
      return [`dashboard:${t.part}`];
  }
}

/** The tab `t` is edited on. */
export function tabFor(t: EditTarget): EditorTab {
  switch (t.kind) {
    case 'source':
      return 'Sources';
    case 'statusSet':
      return 'Statuses';
    case 'row':
    case 'rowGroup':
      return 'Rows';
    case 'stage':
    case 'columnGroup':
      return 'Stages';
    case 'dashboard':
      return t.part === 'stageRules'
        ? 'Stages'
        : t.part === 'statusSets'
          ? 'Statuses'
          : 'General';
  }
}

/** What the editor was opened on: the items to focus, and a check drafted
 * from a record to offer on the focused rule. */
export interface EditFocus {
  focus: readonly string[];
  check?: Check;
}

export const EditFocusContext = createContext<EditFocus>({ focus: [] });

/** Is the item with `key` focused, or does it hold the focused item? */
const isFocused = (focus: readonly string[], key: string): boolean =>
  focus.some((f) => f === key || f.startsWith(`${key}:`));

/** {@link isFocused} for the editor's current focus. */
export function useFocused(key: string | undefined): boolean {
  const { focus } = useContext(EditFocusContext);
  return key !== undefined && isFocused(focus, key);
}

/** The drafted check, if the rule with `key` is the one focused. */
export function useDraftCheck(key: string | undefined): Check | undefined {
  const { focus, check } = useContext(EditFocusContext);
  return key !== undefined && focus[0] === key ? check : undefined;
}
