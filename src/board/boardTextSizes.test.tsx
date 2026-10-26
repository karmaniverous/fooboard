/**
 * Board text sizes on the demo board (spec.md C-13, row N5a, Decisions
 * 63 and 66): on a 390 px phone at rung 0 and at `DEMO_VIEWPORT` no text
 * is under 13 px, the badges, group labels, empty cells and SHAs
 * included. Sizes are worked out from what the board sets
 * (`src/test/fontSize.ts`).
 *
 * @module
 */
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { BoardModel } from '@/engine/types';
import {
  acmeBoard,
  acmeInput,
  acmeModel,
  BOARD_TEST_TIMEOUT_MS,
  DEMO_AREA,
  PHONE_AREA,
} from '@/test/acmeBoard';
import { textSizes } from '@/test/fontSize';
import { renderSettingsBoard } from '@/test/settingsBoard';

import { BADGE_BORDER_PX, BADGE_PAD_X_EM, BASE_FONT_PX } from './boardText';
import { badgeText, EMPTY_SYMBOL } from './cellView';
import { fitLayout, type LayoutInput } from './layout';

const labels = [...acmeBoard.rowGroups, ...acmeBoard.columnGroups].flatMap(
  (g) => (g.label ? [g.label] : []),
);
const symbols: string[] = Object.values(EMPTY_SYMBOL);

/** Every text on the demo board laid out in \`area\` at 100%, with its
 * size, and the layout's rung; the badges, labels and empty symbols
 * picked out, so a test never passes on a board without them. */
function boardText(model: BoardModel, area: LayoutInput) {
  const layout = fitLayout(area, BASE_FONT_PX);
  const badges = Object.values(model.cells).flatMap((c) =>
    c?.badge ? [badgeText(c.badge)] : [],
  );
  renderSettingsBoard(acmeBoard, model, { layout });
  const all = textSizes(screen.getByRole('grid'));
  const sizes = (pick: (t: (typeof all)[number]) => boolean) =>
    new Set(all.filter(pick).map((t) => t.px));
  return {
    rung: layout.rung,
    all,
    badge: sizes((t) => badges.includes(t.text)),
    label: sizes((t) => labels.includes(t.text)),
    empty: sizes((t) => symbols.includes(t.text)),
    sha: sizes((t) => /^[0-9a-f]{7}$/.test(t.text)),
  };
}

describe('board text sizes', () => {
  it(
    'draws no text under 13 px at rung 0 on a 390 px phone',
    async () => {
      const model = await acmeModel();
      const text = boardText(model, acmeInput(model, PHONE_AREA));
      expect(text.rung).toBe(0);
      expect([text.badge, text.label, text.empty]).toEqual([
        new Set([BASE_FONT_PX]),
        new Set([BASE_FONT_PX]),
        new Set([BASE_FONT_PX]),
      ]);
      // Drawn as the layout measures it (`badgeWidth`).
      const badge = text.all.find((t) => t.el.tagName === 'A')?.el;
      expect(badge?.style).toMatchObject({
        paddingInline: `${String(BADGE_PAD_X_EM)}em`,
        borderWidth: `${String(BADGE_BORDER_PX)}px`,
      });
      const small = text.all.filter((t) => t.px < BASE_FONT_PX);
      expect(small.map((t) => `${t.text} ${String(t.px)}`)).toEqual([]);
    },
    BOARD_TEST_TIMEOUT_MS,
  );

  it(
    'draws no text under 13 px at DEMO_VIEWPORT either (Decision 66)',
    async () => {
      const model = await acmeModel();
      const text = boardText(model, acmeInput(model, DEMO_AREA));
      expect([text.badge, text.label, text.empty]).toEqual([
        new Set([BASE_FONT_PX]),
        new Set([BASE_FONT_PX]),
        new Set([BASE_FONT_PX]),
      ]);
      // SHAs show from rung 2, as the demo is here.
      expect(text.rung).toBeGreaterThanOrEqual(2);
      expect(text.sha).toEqual(new Set([BASE_FONT_PX]));
      const small = text.all.filter((t) => t.px < BASE_FONT_PX);
      expect(small.map((t) => `${t.text} ${String(t.px)}`)).toEqual([]);
    },
    BOARD_TEST_TIMEOUT_MS,
  );
});
