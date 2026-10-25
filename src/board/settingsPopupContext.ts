/**
 * The board's settings popup, as the gears see it (spec.md §3.11 *Settings
 * on the board*): which gear's popup is open, and how to open one. One
 * popup is open at a time: opening another replaces it. Provided by
 * `SettingsPopupProvider`; a board without one (a grid on its own) has no
 * gears.
 *
 * @module
 */
import { createContext, use } from 'react';

import type { Dashboard } from '@/domain/config/dashboard';

import type { BoardPlace } from './settingsGearWords';

/** Under this viewport width the popup is a bottom sheet (the width under
 * which the board caps row names at 18%, C-13). */
const SETTINGS_POPUP_NARROW_PX = 640;

/** The media query for a viewport under `SETTINGS_POPUP_NARROW_PX`: the
 * popup is a bottom sheet and headers carry no gears (spec.md §3.11). */
export const SETTINGS_NARROW_QUERY = `(width < ${String(SETTINGS_POPUP_NARROW_PX)}px)`;

/** One opening of the popup. */
export interface PopupRequest {
  place: BoardPlace;
  /** The gear it is anchored to (and whose `aria-expanded` it sets). */
  gearId: string;
  /** Where focus goes when it closes: the gear, or the cell whose `,`
   * opened it. */
  returnFocus: HTMLElement | null;
}

export interface SettingsPopupApi {
  dashboard: Dashboard;
  /** The popup open, if any. */
  request: PopupRequest | null;
  open: (request: PopupRequest) => void;
}

export const SettingsPopupContext = createContext<SettingsPopupApi | null>(
  null,
);

/** The board's popup, or null where the board has none. */
export const useSettingsPopup = (): SettingsPopupApi | null =>
  use(SettingsPopupContext);
