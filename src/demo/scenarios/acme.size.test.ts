/**
 * The demo board's size (spec.md §3.14 *Size*, Decision 54, Q30): at
 * `DEMO_VIEWPORT`, 100% zoom and Default density, with the app header,
 * the board's own layout fits the shipped scenario without vertical
 * scrolling, and one more row would make it scroll. The grid area is
 * `DEMO_AREA` (`src/test/acmeBoard.ts`), as measured in `vite preview`;
 * text is measured at a fixed width per character, as the layout's own
 * tests do.
 */
import { describe, expect, it } from 'vitest';

import { BASE_FONT_PX } from '@/board/boardText';
import { fitLayout } from '@/board/layout';
import {
  acmeBoard,
  acmeInput,
  acmeModel,
  BOARD_TEST_TIMEOUT_MS,
  DEMO_AREA,
} from '@/test/acmeBoard';

describe('the demo board size', () => {
  it(
    'fits the demo viewport without scrolling, and one more row would scroll',
    async () => {
      expect(acmeBoard.rows).toHaveLength(21);
      const model = await acmeModel();
      const fits = fitLayout(acmeInput(model, DEMO_AREA), BASE_FONT_PX);
      expect(fits).toMatchObject({
        overflowX: false,
        overflowY: false,
        format: 'line',
      });
      expect(
        fitLayout(acmeInput(model, DEMO_AREA, 1), BASE_FONT_PX).overflowY,
      ).toBe(true);
    },
    BOARD_TEST_TIMEOUT_MS,
  );
});
