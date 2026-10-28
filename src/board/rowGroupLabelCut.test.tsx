/**
 * A row-group label on a phone (Decision 65, refining §3.7's overflow):
 * on the demo board in a 390 px phone's grid area, a label that would run
 * past the first column frame's line is cut with "…" before it, and
 * keeps its full name in its title and its row header's accessible name;
 * off a phone it overflows the row-name column as before.
 *
 * jsdom lays nothing out, so the cut is checked as the CSS that makes it
 * (the label's widest run, and truncation) and the room as geometry from
 * the layout; the drawn result is measured in a browser (spec.md
 * Verification Checklist, C-13).
 *
 * @module
 */
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  acmeBoard,
  acmeInput,
  acmeModel,
  BOARD_TEST_TIMEOUT_MS,
  DEMO_AREA,
  PHONE_AREA,
} from '@/test/acmeBoard';
import { renderSettingsBoard } from '@/test/settingsBoard';

import { BASE_FONT_PX, labelWidth } from './boardText';
import { FRAME_LINE_PX, rowGroupLabelRoom } from './groupGutters';
import { fitLayout, type LayoutInput } from './layout';

/** The demo's row-group labels. */
const rowLabels = acmeBoard.rowGroups.flatMap((g) =>
  g.label ? [g.label] : [],
);

/** Render the demo board in `area`; its layout and each row-group
 * label's text element and row header. */
async function labels(
  area: Pick<LayoutInput, 'width' | 'height' | 'headerGears'>,
) {
  const model = await acmeModel();
  const input = acmeInput(model, area);
  const layout = fitLayout(input, BASE_FONT_PX);
  renderSettingsBoard(acmeBoard, model, { layout });
  return {
    layout,
    measure: input.measure,
    found: rowLabels.map((label) => {
      const header = screen.getByRole('rowheader', {
        name: new RegExp(`^${label}`),
      });
      return { label, header, text: within(header).getByText(label) };
    }),
  };
}

describe('rowGroupLabelRoom', () => {
  it('ends a cut label a line short of the first frame line', () => {
    const l = { rowNameWidth: 64, padX: 8, gap: 3, gutter: 6 };
    // The text starts past the padding; the line sits centred in the
    // gutter after the row-name column and its gap.
    const lineLeft = l.rowNameWidth + l.gap + (l.gutter - FRAME_LINE_PX) / 2;
    expect(l.padX + rowGroupLabelRoom(l)).toBe(lineLeft - FRAME_LINE_PX);
  });
});

describe('a row-group label on a phone', () => {
  it(
    'is cut before the first frame line, with its full name kept',
    async () => {
      const { layout, measure, found } = await labels(PHONE_AREA);
      expect(layout.phone).toBe(true);
      const room = rowGroupLabelRoom(layout);
      // The demo has a label too long for the room at 13 px: the case.
      const long = found.filter(
        (f) =>
          labelWidth(f.label, layout.fontPx, layout.textEm, measure) > room,
      );
      expect(long.map((f) => f.label)).toContain('Frontend');
      for (const { label, header, text } of found) {
        const run = text.parentElement;
        expect(run?.style.maxWidth).toBe(`${String(room)}px`);
        expect(run).toHaveClass('shrink-0');
        expect(text).toHaveClass('truncate');
        // The full name: the label's title and the row header's name
        // (header gears are hidden on a phone, Decision 60).
        expect(text).toHaveAttribute('title', label);
        expect(text).toHaveTextContent(label);
        expect(header).toHaveAccessibleName(label);
      }
    },
    BOARD_TEST_TIMEOUT_MS,
  );

  it(
    'overflows the row-name column off a phone, as before',
    async () => {
      const { layout, found } = await labels(DEMO_AREA);
      expect(layout.phone).toBe(false);
      for (const { text } of found) {
        expect(text).not.toHaveClass('truncate');
        expect(text.parentElement?.style.maxWidth).toBe('');
        expect(text).not.toHaveAttribute('title');
      }
    },
    BOARD_TEST_TIMEOUT_MS,
  );
});
