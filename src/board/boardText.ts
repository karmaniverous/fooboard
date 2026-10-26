/**
 * The board's smaller text (spec.md C-13): badges, group labels, empty
 * cells and short SHAs are drawn a little smaller than the board's text,
 * in ems of it, so they scale with zoom. On every screen none is smaller
 * than the board's readable size at 100% (`BASE_FONT_PX`, 13 px), so
 * their ems never drop below that floor (spec.md row N5a, Decisions 63
 * and 66). The layout measures badges and group labels as drawn, from
 * the same constants, so a larger badge or label never overflows its
 * room; empty cells and SHAs it measures at the board's size, never
 * smaller than they are drawn (their ems never exceed 1). Pure.
 *
 * @module
 */
import type { Measure } from './packing';

/** Readable text at 100% zoom (C-13). */
export const BASE_FONT_PX = 13;

/** The board's smaller texts. */
export const TEXT_ROLES = ['badge', 'label', 'empty', 'sha'] as const;

export type TextRole = (typeof TEXT_ROLES)[number];

/** Each smaller text's size at one layout, in ems of the board's text. */
export type TextEms = Record<TextRole, number>;

/** Each smaller text's size, in ems of the board's text, before the
 * floor: what it is drawn at once zoomed in past 13 px over its em (from
 * 125% for a badge, about 106% for a SHA); below that, 13 px. */
export const TEXT_EM: Readonly<TextEms> = {
  /** A badge's count (behind or diverged). */
  badge: 0.8,
  /** A row or column group's label. */
  label: 0.85,
  /** An empty cell's symbol, label and reason. */
  empty: 0.9,
  /** The short commit SHA. */
  sha: 0.95,
};

/** Letter spacing of group labels (drawn in capitals), in ems of their
 * own text. */
export const LABEL_TRACKING_EM = 0.025;

/** A badge's padding on each side, in ems of its own text, and its
 * border, in px. */
export const BADGE_PAD_X_EM = 0.45;
export const BADGE_BORDER_PX = 1.5;

/** The smaller texts' sizes at a text size: as `TEXT_EM`, except that
 * none is under `BASE_FONT_PX` at 100%. Below 100% (`fontPx` under 13)
 * the floor is the board's text itself, so every text shrinks alike as
 * the board zooms out; above it, 13 px. */
export function textEms(fontPx: number): TextEms {
  const floor = Math.min(1, BASE_FONT_PX / fontPx);
  const ems = { ...TEXT_EM };
  for (const role of TEXT_ROLES) ems[role] = Math.max(ems[role], floor);
  return ems;
}

/** A group label's drawn width: in capitals, at its own size, with its
 * letter spacing. */
export function labelWidth(
  text: string,
  fontPx: number,
  ems: TextEms,
  measure: Measure,
): number {
  const px = ems.label * fontPx;
  const caps = text.toUpperCase();
  return measure(caps, px) + caps.length * LABEL_TRACKING_EM * px;
}

/** A badge's drawn width: its count at its own size, its padding and its
 * border. */
export function badgeWidth(
  text: string,
  fontPx: number,
  ems: TextEms,
  measure: Measure,
): number {
  const px = ems.badge * fontPx;
  return measure(text, px) + 2 * BADGE_PAD_X_EM * px + 2 * BADGE_BORDER_PX;
}
