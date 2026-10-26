/**
 * The shipped demo board (`acme`) for layout tests: its model once every
 * query has landed, at the scenario's opening; its grid area at
 * `DEMO_VIEWPORT` and on a 390 px phone; and the layout input for a grid
 * area, text measured at a fixed width per character as the layout's own
 * tests do.
 *
 * @module
 */
import { pick } from 'radash';

import { boardGroups } from '@/board/groupGutters';
import type { LayoutInput } from '@/board/layout';
import { boardContents } from '@/board/layoutContents';
import { DEMO_VIEWPORT } from '@/demo/constants';
import { acmeScenario } from '@/demo/scenarios/acme';
import { createBoardModel } from '@/engine';
import type { BoardModel } from '@/engine/types';

import { demoEnv, settle } from './boardModel';
import { measure } from './layoutInput';

export const acmeBoard = acmeScenario.dashboard;

/** Height of everything on the page but the grid area (header, title,
 * toolbar, footer and paddings), at 1920 × 950, as measured in
 * `vite preview`. */
const PAGE_CHROME_PX = 200;
/** Width of the page's side paddings. */
const PAGE_GUTTER_PX = 32;

type Area = Pick<LayoutInput, 'width' | 'height' | 'headerGears'>;

/** The grid area at `DEMO_VIEWPORT`: header gears shown. */
export const DEMO_AREA: Area = {
  width: DEMO_VIEWPORT.width - PAGE_GUTTER_PX,
  height: DEMO_VIEWPORT.height - PAGE_CHROME_PX,
  headerGears: true,
};

/** The phone the C-13 targets name (390 × 844): no header gears, as
 * under 640 px (spec.md §3.11). */
const PHONE_VIEWPORT = { width: 390, height: 844 } as const;
export const PHONE_AREA: Area = {
  width: PHONE_VIEWPORT.width - PAGE_GUTTER_PX,
  height: PHONE_VIEWPORT.height - PAGE_CHROME_PX,
  headerGears: false,
};

/** Building a whole demo board takes seconds, more on a busy runner. */
export const BOARD_TEST_TIMEOUT_MS = 60_000;

/** The demo board's model at the scenario's opening. */
export async function acmeModel(): Promise<BoardModel> {
  const env = demoEnv(() => 0, undefined, acmeScenario);
  const handle = createBoardModel({ dashboard: acmeBoard, env });
  const model = await settle(env, handle);
  handle.destroy();
  return model;
}

/** The layout input for the demo board in a grid area, with `extraRows`
 * more rows than it has. */
export function acmeInput(
  model: BoardModel,
  area: Area,
  extraRows = 0,
): LayoutInput {
  return {
    ...area,
    rows: acmeBoard.rows.length + extraRows,
    stages: acmeBoard.stages.length,
    ...pick(boardGroups(acmeBoard), [
      'labelRows',
      'columnGutters',
      'rowGutters',
    ]),
    rowNames: [
      ...acmeBoard.rows.map((r) => r.displayName),
      ...Array.from({ length: extraRows }, () => 'one-more'),
    ],
    contents: boardContents(acmeBoard, model, area.headerGears),
    measure,
    density: 'default',
  };
}
