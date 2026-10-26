/**
 * The demo board's size (spec.md §3.14 *Size*, Decision 54, Q30): at
 * `DEMO_VIEWPORT`, 100% zoom and Default density, with the app header,
 * the board's own layout fits the shipped scenario without vertical
 * scrolling, and one more row would make it scroll. The page around the
 * grid (header, title, toolbar, footer and paddings) takes
 * `PAGE_CHROME_PX` of the height and `PAGE_GUTTER_PX` of the width, as
 * measured in `vite preview`; text is measured at a fixed width per
 * character, as the layout's own tests do.
 */
import { pick } from 'radash';
import { describe, expect, it } from 'vitest';

import { BASE_FONT_PX } from '@/board/boardText';
import { boardGroups } from '@/board/groupGutters';
import { fitLayout, type LayoutInput } from '@/board/layout';
import { boardContents } from '@/board/layoutContents';
import { DEMO_VIEWPORT } from '@/demo/constants';
import { createBoardModel } from '@/engine';
import { demoEnv, settle } from '@/test/boardModel';

import { acmeScenario } from './acme';

/** Height of everything on the page but the grid area, at 1920 × 950. */
const PAGE_CHROME_PX = 200;
/** Width of the page's side paddings. */
const PAGE_GUTTER_PX = 32;
const measure = (text: string, px: number) => text.length * px * 0.6;

const board = acmeScenario.dashboard;

async function input(extraRows: number): Promise<LayoutInput> {
  const env = demoEnv(() => 0, undefined, acmeScenario);
  const handle = createBoardModel({ dashboard: board, env });
  const model = await settle(env, handle);
  handle.destroy();
  const rows = board.rows.length + extraRows;
  return {
    width: DEMO_VIEWPORT.width - PAGE_GUTTER_PX,
    height: DEMO_VIEWPORT.height - PAGE_CHROME_PX,
    rows,
    stages: board.stages.length,
    ...pick(boardGroups(board), ['labelRows', 'columnGutters', 'rowGutters']),
    rowNames: [
      ...board.rows.map((r) => r.displayName),
      ...Array.from({ length: extraRows }, () => 'one-more'),
    ],
    contents: boardContents(board, model, true),
    measure,
    density: 'default',
    headerGears: true,
  };
}

/** Building a whole demo board takes seconds, more on a busy runner. */
const BOARD_TEST_TIMEOUT_MS = 60_000;

describe('the demo board size', () => {
  it(
    'fits the demo viewport without scrolling, and one more row would scroll',
    async () => {
      expect(board.rows).toHaveLength(21);
      const fits = fitLayout(await input(0), BASE_FONT_PX);
      expect(fits).toMatchObject({
        overflowX: false,
        overflowY: false,
        format: 'line',
      });
      expect(fitLayout(await input(1), BASE_FONT_PX).overflowY).toBe(true);
    },
    BOARD_TEST_TIMEOUT_MS,
  );
});
