/**
 * A board for the group frame and gutter tests (spec.md §3.7): the demo's
 * 19 x 6 board regrouped to have a labelled row group first, ungrouped
 * rows, an unlabelled row group, a labelled three-stage column group, an
 * ungrouped stage, a single-member unlabelled column group and another
 * ungrouped stage; and a layout whose track sizes all differ.
 *
 * @module
 */
import { screen } from '@testing-library/react';
import { omit } from 'radash';

import type { Layout } from '@/board/layout';
import { measureBoard } from '@/demo/scenarios/measure';
import type { Dashboard } from '@/domain/config/dashboard';
import { emptyModel } from '@/engine';
import { TEST_LAYOUT } from '@/test/boardLayout';
import { renderSettingsBoard } from '@/test/settingsBoard';

/** Distinct sizes, so each track's kind shows in the template. */
export const LAYOUT: Layout = {
  ...TEST_LAYOUT,
  rowNameWidth: 120,
  colWidth: 100,
  rowHeight: 30,
  lineRowHeight: 20,
  gutter: 7,
  gap: 3,
  padY: 4,
};

const [b1, b2, b3, ...restIds] = measureBoard.rows.map((r) => r.id);
/** The demo's Frontend rows (its second row group). */
export const amplifyIds = measureBoard.rowGroups[1].memberIds;
export const ungroupedIds = restIds.filter((id) => !amplifyIds.includes(id));

/** Row groups: Backend (labelled, first), ungrouped rows, then Frontend
 * unlabelled, then nothing; column groups: Preview (labelled, three
 * stages), Dev ungrouped, a single-member unlabelled group, Prod. */
export const board: Dashboard = {
  ...measureBoard,
  rowGroups: [
    { ...measureBoard.rowGroups[0], memberIds: [b1, b2, b3] },
    omit(measureBoard.rowGroups[1], ['label']),
  ],
  columnGroups: [
    ...measureBoard.columnGroups,
    { id: 'single', memberIds: ['release'], settings: {}, stageRules: {} },
  ],
};

export const renderFramed = (
  dashboard: Dashboard = board,
  layout: Layout = LAYOUT,
): HTMLElement => {
  renderSettingsBoard(dashboard, emptyModel(), { layout });
  return screen.getByRole('grid');
};
export const tracks = (template: string): number[] =>
  template.split(' ').map((t) => Number(t.replace('px', '')));
export const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
export const frames = (grid: HTMLElement): HTMLElement[] => [
  ...grid.querySelectorAll<HTMLElement>('[data-frame]'),
];
export const rowLines = (grid: HTMLElement): HTMLElement[] => [
  ...grid.querySelectorAll<HTMLElement>('[data-boundary=row]'),
];

/** The board with Frontend labelled again: its label row carries its line. */
export const labelledBoard: Dashboard = {
  ...board,
  rowGroups: [board.rowGroups[0], measureBoard.rowGroups[1]],
};
