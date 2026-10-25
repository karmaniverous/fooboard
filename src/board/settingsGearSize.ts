/**
 * The settings gears' named layout constants (spec.md §3.11 *Settings on
 * the board*, C-13). Sizes are in ems of the board's text, so they scale
 * with zoom as the text does. A header's or group label's gear is part of
 * its worst-case size, so it never reflows the board; a cell's corner
 * gear is laid over the cell and takes no room. Set from the layout check
 * at rung 0 (N3d's PR).
 *
 * @module
 */

/** The gear's size, in ems: big enough to see and hit at rung 0 at 100%
 * (12 px of a 13 px text), small enough to sit in a cell's corner beside
 * its centred icon at Compact density, whose rows are about 1.6 em high. */
export const SETTINGS_GEAR_SIZE = 0.9;

/** The corner gear's inset from the cell's top and right edges, in ems:
 * clear of the rounded corner, inside the cell at every density. */
export const SETTINGS_GEAR_INSET = 0.12;

/** Space between a header's or label's text and its gear, in ems. */
export const HEADER_GEAR_GAP = 0.3;

/** The width a header or group label reserves for its gear, in ems. */
export const HEADER_GEAR_EM = SETTINGS_GEAR_SIZE + HEADER_GEAR_GAP;
