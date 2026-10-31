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
 *   Under `SETTINGS_POPUP_NARROW_PX` the board has none, and reserves no
 *   room for them (`HeaderGearsContext`), so row names get their column.
 * - **The cell gear** is one gear for the whole grid (`CellGearLayer`),
 *   laid over the corner of the cell the pointer is over or focus is in,
 *   out of the Tab order (`,` on the focused cell opens its popup).
 * - **The detail sheet's gear** is the way in on a touch screen.
 *
 * Header and label gears take pointer events even while a popup has
 * disabled the page's, so clicking one closes the open popup and opens
 * its own.
 *
 * @module
 */
import { Settings } from 'lucide-react';
import { use, useId } from 'react';

import { cn } from '@/lib/utils';

import { HeaderGearsContext } from './headerGears';
import type { BoardPlace } from './settingsGearWords';
import { gearLabel } from './settingsGearWords';
import { useSettingsPopup } from './settingsPopupContext';
import { SETTINGS_GEAR_PROPS } from './useAttentionEvents';

/** Where the gear sits. */
export type GearSpot = 'header' | 'corner' | 'sheet';

const SPOT: Record<GearSpot, string> = {
  header:
    'pointer-events-auto ml-[var(--gear-gap)] size-[var(--gear-size)] text-muted-foreground hover:text-foreground',
  corner: cn(
    'absolute left-0 top-0 z-10 size-[var(--gear-size)] p-[0.08em]',
    'rounded-full bg-background/85 text-foreground shadow-sm',
  ),
  sheet: 'size-6 p-0.5 text-slate-300 hover:text-white',
};

export function SettingsGear({
  place,
  spot,
  id,
  ref,
  marks,
}: {
  place: BoardPlace;
  spot: GearSpot;
  /** The gear's element id, when its cell opens its popup by key. */
  id?: string;
  /** The button, for the cell gear to place it. */
  ref?: React.Ref<HTMLButtonElement>;
  /** Data attributes for the button: the cell gear names its cell. */
  marks?: Record<`data-${string}`, string>;
}): React.JSX.Element | null {
  const popup = useSettingsPopup();
  const headerGears = use(HeaderGearsContext);
  const ownId = useId();
  const gearId = id ?? ownId;
  if (!popup || (spot === 'header' && !headerGears)) return null;
  const expanded = popup.request?.gearId === gearId;
  return (
    <button
      ref={ref}
      id={gearId}
      type="button"
      tabIndex={spot === 'corner' ? -1 : undefined}
      aria-label={gearLabel(popup.dashboard, place)}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      {...SETTINGS_GEAR_PROPS}
      {...marks}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        SPOT[spot],
      )}
      onClick={(e) => {
        popup.open({ place, gearId, returnFocus: e.currentTarget });
      }}
    >
      <Settings aria-hidden className="size-full" />
    </button>
  );
}
