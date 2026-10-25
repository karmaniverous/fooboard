/**
 * A settings gear (spec.md §3.11 *Settings on the board*, Decisions 52 and
 * 54): the one button that opens the settings popup for its place, on
 * every row header, stage header, labelled group label and cell, and in
 * the cell detail sheet. It is named for its place ("Settings for row
 * api-users"), says it opens a dialog and whether its popup is open.
 *
 * - **Header and label gears** are ordinary buttons in the Tab order,
 *   sized from `SETTINGS_GEAR_SIZE` (their room is reserved in the
 *   header's or label's worst-case size, so they never reflow the board).
 * - **A cell's corner gear** is laid over the cell's top-right corner as a
 *   sibling of the cell's link or button (never inside it), out of the Tab
 *   order (`,` on the focused cell opens its popup instead), and shown only
 *   while the pointer is over the cell, keyboard focus is in it, or its
 *   popup is open. Hidden, it takes no pointer events, so a tap on the
 *   corner of a cell still opens the cell's sheet.
 * - **The detail sheet's gear** is the way in on a touch screen.
 *
 * Header and label gears take pointer events even while a popup has
 * disabled the page's, so clicking one closes the open popup and opens
 * its own.
 *
 * @module
 */
import { Settings } from 'lucide-react';
import { useId } from 'react';

import { cn } from '@/lib/utils';

import type { BoardPlace } from './settingsGearWords';
import { gearLabel } from './settingsGearWords';
import { useSettingsPopup } from './settingsPopupContext';

/** Where the gear sits. */
export type GearSpot = 'header' | 'corner' | 'sheet';

const SPOT: Record<GearSpot, string> = {
  header:
    'pointer-events-auto ml-[var(--gear-gap)] size-[var(--gear-size)] text-muted-foreground hover:text-foreground',
  corner: cn(
    'absolute right-[var(--gear-inset)] top-[var(--gear-inset)] z-10 size-[var(--gear-size)] p-[0.08em]',
    'rounded-full bg-background/85 text-foreground shadow-sm',
    'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100',
    'group-has-[:focus-visible]:opacity-100 aria-expanded:opacity-100',
  ),
  sheet: 'size-6 p-0.5 text-slate-300 hover:text-white',
};

export function SettingsGear({
  place,
  spot,
  id,
  icon = true,
}: {
  place: BoardPlace;
  spot: GearSpot;
  /** The gear's element id, when its cell opens its popup by key. */
  id?: string;
  /** Draw the icon. A corner gear draws it only while it can be seen
   * (the pointer over its cell, focus in it, its popup open): a board
   * has a gear per cell, and their icons were most of what the gears
   * added to a re-layout (N3d's PR). */
  icon?: boolean;
}): React.JSX.Element | null {
  const popup = useSettingsPopup();
  const ownId = useId();
  const gearId = id ?? ownId;
  if (!popup) return null;
  const expanded = popup.request?.gearId === gearId;
  return (
    <button
      id={gearId}
      type="button"
      tabIndex={spot === 'corner' ? -1 : undefined}
      aria-label={gearLabel(popup.dashboard, place)}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        SPOT[spot],
      )}
      onClick={(e) => {
        popup.open({ place, gearId, returnFocus: e.currentTarget });
      }}
    >
      {(icon || expanded) && <Settings aria-hidden className="size-full" />}
    </button>
  );
}
