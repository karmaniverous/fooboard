/**
 * The board's attention events (spec 0.2.0 §3.H *What boosts a row*,
 * Decisions 79, 85 and 97), heard by delegated listeners on
 * `CellGearLayer`'s element, so cells and headers carry no handlers:
 *
 * - **Click:** a primary `click` on a cell (its cover link or button, a
 *   tap included), on a row header or on a row group's label boosts the
 *   cell's row, the header's row or the group's rows. A middle or
 *   secondary click fires no `click`, so it doesn't count; a click inside
 *   a settings gear is left to the popup, which boosts as it opens.
 * - **Keys:** Space on a link cover (`CellCover` opens the sheet on
 *   `keydown`, so no `click` follows; a button cover's Space comes as its
 *   `click`, counted once), and Enter on a focused row header itself (it
 *   has no click handler), count as clicks.
 * - **Dwell:** the mouse or a pen resting on a cell, or keyboard focus
 *   (`:focus-visible`) resting on it, for `DWELL_MS` boosts its row once
 *   per entry; moving between a cell and its own gear isn't leaving it,
 *   and touch has no dwell (a tap is a click).
 *
 * @module
 */
import { useEffect, useRef } from 'react';

import { CellKeySchema } from '@/engine';

import { type AttentionTarget, useAttend } from './attentionContext';
import { gearOwnerOf, gearTargetKey, gearTargetOf } from './cellGearTarget';
import { DETAILS_KEY } from './cellView';

/** How long the pointer or keyboard focus rests on a cell before it
 * counts as interest (Decision 79): longer than a pass across the board,
 * short enough that reading a cell's tooltip counts. */
export const DWELL_MS = 1_500;

/** The attribute naming a row header's row (spec 0.2.0 §3.H). */
const ATTEND_ROW = 'data-attend-row';
/** The attribute naming a row group label's group. */
const ATTEND_GROUP = 'data-attend-group';
/** The attribute marking a settings gear, whose clicks the popup hears. */
const SETTINGS_GEAR = 'data-settings-gear';

/** A row header's mark: its row. */
export const attendRowProps = (
  rowId: string,
): Record<typeof ATTEND_ROW, string> => ({ [ATTEND_ROW]: rowId });

/** A row group label's mark: its group. */
export const attendGroupProps = (
  groupId: string,
): Record<typeof ATTEND_GROUP, string> => ({ [ATTEND_GROUP]: groupId });

/** A settings gear's mark. */
export const SETTINGS_GEAR_PROPS: Record<typeof SETTINGS_GEAR, string> = {
  [SETTINGS_GEAR]: '',
};

/** The key that "clicks" a focused row header. */
const ENTER = 'Enter';

/** A cell the user may rest on: its key and row. */
interface AttendedCell {
  key: string;
  rowId: string;
}

/** The cell `node` is in, or whose corner gear it is. */
function cellOf(node: EventTarget | null): AttendedCell | null {
  if (!(node instanceof Element)) return null;
  const target = gearTargetOf(node);
  if (target) return { key: gearTargetKey(target), rowId: target.rowId };
  const owner = gearOwnerOf(node);
  if (owner === undefined) return null;
  const parsed = CellKeySchema.safeParse(JSON.parse(owner));
  return parsed.success ? { key: owner, rowId: parsed.data[0] } : null;
}

/** What a click on `node` shows interest in: its cell's row, its row
 * header's row or its label's group. */
function clickTarget(node: Element): AttentionTarget | undefined {
  const cell = cellOf(node);
  if (cell) return { level: 'row', rowId: cell.rowId };
  const row = node.closest(`[${ATTEND_ROW}]`)?.getAttribute(ATTEND_ROW);
  if (row != null) return { level: 'row', rowId: row };
  const group = node.closest(`[${ATTEND_GROUP}]`)?.getAttribute(ATTEND_GROUP);
  return group == null ? undefined : { level: 'rowGroup', groupId: group };
}

/** One kind of resting (the pointer's, or focus's): the cell entered
 * last, and the dwell timer running for it. */
function dweller(onDwell: (rowId: string) => void) {
  let key: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    /** Rest on `cell` (none: rest nowhere). The same cell again changes
     * nothing, so a dwell fires once per entry. */
    enter(cell: AttendedCell | null): void {
      if ((cell?.key ?? null) === key) return;
      clearTimeout(timer);
      timer = undefined;
      key = cell?.key ?? null;
      if (!cell) return;
      timer = setTimeout(() => {
        timer = undefined;
        onDwell(cell.rowId);
      }, DWELL_MS);
    },
  };
}

/** A key pressed with no modifier, and not held down. */
const plainKey = (e: KeyboardEvent): boolean =>
  !e.repeat && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey;

/** Hear the board's attention events on `layer` and boost through the
 * board's `attend` (`AttentionContext`). */
export function useAttentionEvents(
  layer: React.RefObject<HTMLElement | null>,
): void {
  const attend = useAttend();
  const latest = useRef(attend);
  useEffect(() => {
    latest.current = attend;
  }, [attend]);

  useEffect(() => {
    const el = layer.current;
    if (!el) return;
    const row = (rowId: string): AttentionTarget => ({ level: 'row', rowId });
    const dwell = (rowId: string) => {
      latest.current(row(rowId), 'dwell');
    };
    const pointer = dweller(dwell);
    const focus = dweller(dwell);
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || !(e.target instanceof Element)) return;
      if (e.target.closest(`[${SETTINGS_GEAR}]`)) return;
      const target = clickTarget(e.target);
      if (target) latest.current(target, 'click');
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!plainKey(e) || !(e.target instanceof Element)) return;
      const linkCover =
        e.key === DETAILS_KEY.key && e.target.matches('a[data-cell-control]');
      const rowId =
        e.key === ENTER ? e.target.getAttribute(ATTEND_ROW) : undefined;
      const cell = linkCover ? cellOf(e.target) : null;
      if (cell) latest.current(row(cell.rowId), 'click');
      else if (rowId != null) latest.current(row(rowId), 'click');
    };
    const onPointerOver = (e: PointerEvent) => {
      if (e.pointerType !== 'touch') pointer.enter(cellOf(e.target));
    };
    const onPointerLeave = () => {
      pointer.enter(null);
    };
    const onFocusIn = (e: FocusEvent) => {
      const keyboard =
        e.target instanceof Element && e.target.matches(':focus-visible');
      focus.enter(keyboard ? cellOf(e.target) : null);
    };
    const onFocusOut = (e: FocusEvent) => {
      // Focus moving within the layer is heard as it arrives.
      if (!(e.relatedTarget instanceof Node && el.contains(e.relatedTarget)))
        focus.enter(null);
    };
    el.addEventListener('click', onClick);
    el.addEventListener('keydown', onKeyDown);
    el.addEventListener('pointerover', onPointerOver);
    el.addEventListener('pointerleave', onPointerLeave);
    el.addEventListener('focusin', onFocusIn);
    el.addEventListener('focusout', onFocusOut);
    return () => {
      el.removeEventListener('click', onClick);
      el.removeEventListener('keydown', onKeyDown);
      el.removeEventListener('pointerover', onPointerOver);
      el.removeEventListener('pointerleave', onPointerLeave);
      el.removeEventListener('focusin', onFocusIn);
      el.removeEventListener('focusout', onFocusOut);
      pointer.enter(null);
      focus.enter(null);
    };
  }, [layer]);
}
