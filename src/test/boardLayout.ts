/**
 * The board layout grid tests render with: rung 1, one line, as on a
 * small screen.
 *
 * @module
 */
import type { Layout } from '@/board/layout';

export const TEST_LAYOUT: Layout = {
  rung: 1,
  format: 'line',
  lineOf: {},
  fontPx: 13,
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
};
