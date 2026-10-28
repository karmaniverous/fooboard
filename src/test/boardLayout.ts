/**
 * The board layout grid tests render with: rung 1, one line, as on a
 * small screen.
 *
 * @module
 */
import { textEms } from '@/board/boardText';
import type { Layout } from '@/board/layout';

/** The test layout's text size, at 100%. */
const FONT_PX = 13;

export const TEST_LAYOUT: Layout = {
  rung: 1,
  format: 'line',
  lineOf: {},
  fontPx: FONT_PX,
  rowNameWidth: 120,
  colWidth: 100,
  rowHeight: 26,
  lineRowHeight: 26,
  gap: 3,
  padX: 8,
  padY: 4,
  overflowX: false,
  overflowY: false,
  boardHeight: 600,
  boardWidth: 800,
  gutter: 9,
  headerGears: true,
  phone: false,
  textEm: textEms(FONT_PX),
};
