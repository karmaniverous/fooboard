/**
 * The board's one cell gear (spec.md §3.11 *The cell's gear*, Decision
 * 60): a single `SettingsGear` for the whole grid, laid over the top-right
 * corner of the cell the pointer is over or keyboard focus is in, rather
 * than a gear in every cell. It is a sibling of the grid, so it is never
 * inside a cell's link or button; it is out of the Tab order, so each cell
 * stays one Tab stop; it is named for its cell; and `,`
 * (`CELL_SETTINGS_KEY`) on a focused cell opens that cell's popup,
 * anchored to it, with focus back on the cell when the popup closes.
 *
 * The layer listens on its own element (events bubble up from the cells),
 * so cells carry no handlers or state for it. Moving the gear re-renders
 * only the layer: the grid is its `children`, the same element on every
 * layer render, so React leaves the cells alone. The gear is placed by a
 * transform from its cell's rect, measured against the layer's; both
 * scroll together (the page scrolls, not the grid, C-13), so the offset
 * holds while the page scrolls, and it is measured again whenever the
 * board re-renders (a new layout). It is hidden on a touch screen, where
 * the detail sheet carries the gear.
 *
 * @module
 */
import { useId, useLayoutEffect, useRef, useState } from 'react';

import { type GearTarget, gearTargetOf } from './cellGearTarget';
import { CELL_SETTINGS_KEY } from './cellView';
import { SettingsGear } from './SettingsGear';
import { useSettingsPopup } from './settingsPopupContext';

/** Keyboard focus, not focus a click left behind. */
const keyboardFocus = (node: EventTarget): boolean =>
  node instanceof Element && node.matches(':focus-visible');

export function CellGearLayer({
  style,
  children,
}: {
  /** The board's text size and gear sizes, inherited by the grid. */
  style: React.CSSProperties;
  children: React.ReactNode;
}): React.JSX.Element {
  const popup = useSettingsPopup();
  const gearId = useId();
  const layer = useRef<HTMLDivElement>(null);
  const gear = useRef<HTMLButtonElement>(null);
  const hovered = useRef<GearTarget | null>(null);
  const focused = useRef<GearTarget | null>(null);
  /** Which came last: the pointer moving or focus arriving. */
  const lead = useRef<'pointer' | 'focus'>('pointer');
  const [shown, setShown] = useState<GearTarget | null>(null);
  // Its popup open, the gear stays where it is (the popup's anchor).
  const expanded = popup?.request?.gearId === gearId;

  const pick = () => {
    if (expanded) return;
    const [first, second] =
      lead.current === 'focus'
        ? [focused.current, hovered.current]
        : [hovered.current, focused.current];
    // Focus on the gear itself (after its popup closes) keeps it.
    const kept =
      shown && gear.current === document.activeElement ? shown : null;
    const next = first ?? second ?? kept;
    if (next?.el !== shown?.el) setShown(next);
  };

  useLayoutEffect(() => {
    const g = gear.current;
    const l = layer.current;
    if (!g || !l || !shown) return;
    const cell = shown.el.getBoundingClientRect();
    const box = l.getBoundingClientRect();
    const x = String(cell.right - box.left);
    const y = String(cell.top - box.top);
    g.style.transform = `translate(calc(${x}px - 100% - var(--gear-inset)), calc(${y}px + var(--gear-inset)))`;
  });

  return (
    <div
      ref={layer}
      className="relative w-max"
      style={style}
      onPointerOver={(e) => {
        if (
          e.pointerType === 'touch' ||
          (e.target instanceof Node && gear.current?.contains(e.target))
        )
          return;
        hovered.current = gearTargetOf(e.target);
        lead.current = 'pointer';
        pick();
      }}
      onPointerLeave={() => {
        hovered.current = null;
        pick();
      }}
      onFocus={(e) => {
        const target = gearTargetOf(e.target);
        if (!target || !keyboardFocus(e.target)) return;
        focused.current = target;
        lead.current = 'focus';
        pick();
      }}
      onBlur={(e) => {
        if (gearTargetOf(e.target)) focused.current = null;
        pick();
      }}
      onKeyDown={(e) => {
        const target = gearTargetOf(e.target);
        if (
          !popup ||
          !target ||
          e.key !== CELL_SETTINGS_KEY.key ||
          e.altKey ||
          e.ctrlKey ||
          e.metaKey ||
          !(e.target instanceof HTMLElement)
        )
          return;
        focused.current = target;
        lead.current = 'focus';
        setShown(target);
        popup.open({
          place: {
            level: 'cell',
            rowId: target.rowId,
            stageId: target.stageId,
          },
          gearId,
          returnFocus: e.target,
        });
      }}
    >
      {children}
      {shown && (
        <SettingsGear
          ref={gear}
          id={gearId}
          place={{ level: 'cell', rowId: shown.rowId, stageId: shown.stageId }}
          spot="corner"
        />
      )}
    </div>
  );
}
