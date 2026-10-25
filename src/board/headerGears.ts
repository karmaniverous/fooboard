/**
 * Whether the board's headers carry settings gears (spec.md §3.11,
 * Decision 60): row headers, stage headers and labelled group labels have
 * a gear, and room reserved for it, except under
 * `SETTINGS_POPUP_NARROW_PX`, where row names need the room and settings
 * at those levels are reached from the dashboard editor (a cell's from its
 * detail sheet). The layout decides (`Layout.headerGears`) and the grid
 * provides it, so the gears and the room for them always agree.
 *
 * @module
 */
import { createContext } from 'react';

import { HEADER_GEAR_EM } from './settingsGearSize';

export const HeaderGearsContext = createContext(true);

/** The width a header or label reserves for its gear, in ems: none when
 * the board has no header gears. */
export const headerGearEm = (headerGears: boolean): number =>
  headerGears ? HEADER_GEAR_EM : 0;
