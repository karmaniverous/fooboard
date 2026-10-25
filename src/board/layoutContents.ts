/**
 * What every box on the board shows at each detail rung (spec.md C-13),
 * for worst-case sizing. Fixed-form fields are given at their longest form
 * (status name, relative time, short commit), so polling cannot
 * change the layout through them. Badges are taken as shown (capped at
 * 99+): every status cell reserves the widest badge on the board, so all
 * cells pack alike. Free text (branches, commit messages, stage names,
 * group labels) is taken as it is, capped. Stage headers and labelled
 * group labels keep room for their settings gear (spec.md §3.11), always
 * shown. Pure.
 *
 * @module
 */
import type { Dashboard } from '@/domain/config/dashboard';
import type { StatusSet } from '@/domain/config/statusSets';
import { groupSegments } from '@/domain/groups/segments';
import { PRESETS } from '@/domain/statuses/presets';
import { UNKNOWN } from '@/domain/statuses/resolved';
import type { BoardModel } from '@/engine';

import {
  badgeText,
  EMPTY_LABEL,
  EMPTY_SYMBOL,
  firstLine,
  SHORT_SHA_LENGTH,
} from './cellView';
import { headerGearEm } from './headerGears';
import { capText, type Rung, RUNG_SHOWS } from './layout';
import { type Content, type Item } from './packing';

/** Longest forms of the fixed fields. */
const LONGEST = { time: '59m', commit: '0'.repeat(SHORT_SHA_LENGTH) } as const;

/** The longest status name any cell could show: across every preset, the
 * dashboard's own sets and Unknown, so polling never reflows the board. */
const longestStatus = (custom: readonly StatusSet[]): string =>
  [...PRESETS, ...custom]
    .flatMap((s) => s.cell.map((c) => c.name))
    .reduce((a, n) => (n.length > a.length ? n : a), UNKNOWN.name);

/** At rung 0 headers are cut to a few characters (full name in the title). */
const HEADER_MIN_CHARS = 4;
const shortHeader = (name: string) =>
  name.length > HEADER_MIN_CHARS
    ? `${name.slice(0, HEADER_MIN_CHARS)}\u2026`
    : name;

/** Build the per-rung contents for a board. */
export function boardContents(
  dashboard: Pick<Dashboard, 'stages' | 'columnGroups' | 'customStatusSets'>,
  model: Pick<BoardModel, 'cells'>,
  /** Headers carry settings gears (spec.md §3.11): keep room for them. */
  headerGears: boolean,
): (rung: Rung) => Content[] {
  const trail = headerGearEm(headerGears);
  const status = longestStatus(dashboard.customStatusSets);
  const badges = Object.values(model.cells).flatMap((c) =>
    c?.badge ? [badgeText(c.badge)] : [],
  );
  const widestBadge = badges.reduce<string | undefined>(
    (a, b) => (a === undefined || b.length > a.length ? b : a),
    undefined,
  );
  const groups = groupSegments(
    dashboard.stages.map((s) => s.id),
    dashboard.columnGroups,
  ).flatMap((g) =>
    g.group?.label ? [{ label: g.group.label, span: g.span }] : [],
  );
  const headers = (rung: Rung): Content[] => [
    ...dashboard.stages.map((s) => ({
      lead: rung === 0 ? shortHeader(s.name) : capText(s.name),
      trail,
      items: [],
    })),
    ...groups.map((g) => ({
      span: g.span,
      lead: capText(g.label),
      trail,
      items: [],
    })),
  ];
  return (rung) => {
    const out = headers(rung);
    for (const cell of Object.values(model.cells)) {
      if (!cell) continue;
      const d = cell.derivation;
      if (d.kind === 'empty') {
        const extra = d.reason;
        out.push({
          lead: rung === 0 ? EMPTY_SYMBOL[d.state] : EMPTY_LABEL[d.state],
          items:
            rung >= RUNG_SHOWS.branch && extra
              ? [{ key: 'extra', text: capText(extra), free: true }]
              : [],
        });
        continue;
      }
      const items: Item[] = [];
      if (rung >= RUNG_SHOWS.time)
        items.push({ key: 'time', text: LONGEST.time });
      if (rung >= RUNG_SHOWS.commit) {
        items.push({ key: 'commit', text: LONGEST.commit, badge: widestBadge });
      }
      if (rung >= RUNG_SHOWS.branch && d.branch)
        items.push({ key: 'branch', text: capText(d.branch), free: true });
      if (rung >= RUNG_SHOWS.message && d.message) {
        items.push({
          key: 'message',
          text: capText(firstLine(d.message)),
          free: true,
        });
      }
      out.push({
        lead: rung === 0 ? '\u2298' : `\u2298 ${status}`,
        // From the commit rung the badge follows the commit it describes.
        badge: rung < RUNG_SHOWS.commit ? widestBadge : undefined,
        items,
      });
    }
    return out;
  };
}
