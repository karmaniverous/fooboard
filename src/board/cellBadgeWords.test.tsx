/**
 * Tests for a cell's behind/diverged badge in words (spec.md §3.10, §3.11;
 * Decision 74): with focus on the badge, the tooltip names `,` for
 * settings, and only on a board that has settings (Space would follow the
 * badge's link, so it is never named there); `,` on the badge opens the
 * cell's settings popup; and every count agrees with its noun, "1 commit"
 * or "2 commits", in the badge's and the cell's accessible names and in
 * the tooltip.
 *
 * @module
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it } from 'vitest';

import { measureBoard } from '@/demo/scenarios/measure';
import type { StalenessBadge } from '@/domain/derivation';
import type { BoardModel } from '@/engine';
import { TEST_LAYOUT } from '@/test/boardLayout';
import { fullModel } from '@/test/boardModel';
import { badgeCell, tooltipText } from '@/test/cellTooltip';
import { focusElement } from '@/test/focus';
import { renderSettingsBoard } from '@/test/settingsBoard';

import { BoardGrid } from './BoardGrid';

let model: BoardModel;
beforeAll(async () => {
  model = await fullModel(measureBoard);
});

/** The board's grid with no settings popup (no provider around it). */
const renderPlainBoard = (m: BoardModel = model) =>
  render(
    <MemoryRouter>
      <BoardGrid
        dashboard={measureBoard}
        model={m}
        layout={TEST_LAYOUT}
        now={0}
      />
    </MemoryRouter>,
  );

const tip = tooltipText;

describe('focus on a badge', () => {
  it('names comma for settings, and not Space, on a board with settings', () => {
    renderSettingsBoard(measureBoard, model);
    const { badge } = badgeCell();
    focusElement(badge);
    expect(tip()).toMatch(/billing/);
    expect(tip()).toMatch(/Press , \(comma\) for settings$/);
    expect(tip()).not.toMatch(/Space/);
  });

  it('opens the cell’s settings popup on comma', () => {
    renderSettingsBoard(measureBoard, model);
    const { badge } = badgeCell();
    focusElement(badge);
    fireEvent.keyDown(badge, { key: ',' });
    expect(screen.getByRole('dialog')).toHaveAccessibleName(
      /^Cell settings: billing × /,
    );
  });

  it('names no key on a board without settings', () => {
    renderPlainBoard();
    const { badge, cover } = badgeCell();
    focusElement(cover);
    expect(tip()).toMatch(/Press Space for details$/);
    focusElement(badge);
    expect(tip()).toMatch(/billing/);
    expect(tip()).not.toMatch(/Press/);
  });
});

/** `model` with the first behind badge replaced by `badge`. */
const withBadge = (badge: NonNullable<StalenessBadge>): BoardModel => {
  const key = Object.keys(model.cells).find(
    (k) => model.cells[k]?.badge?.kind === 'behind',
  );
  const cell = key ? model.cells[key] : undefined;
  if (!key || !cell) throw new Error('the demo has no behind badge');
  return { ...model, cells: { ...model.cells, [key]: { ...cell, badge } } };
};

describe('badge counts in words', () => {
  it.each([
    [{ kind: 'behind', count: 1 } as const, '1 commit behind its source'],
    [{ kind: 'behind', count: 2 } as const, '2 commits behind its source'],
    [
      { kind: 'diverged', behind: 1, ahead: 1 } as const,
      'diverged: 1 commit behind, 1 commit ahead of its source',
    ],
    [
      { kind: 'diverged', behind: 2, ahead: 1 } as const,
      'diverged: 2 commits behind, 1 commit ahead of its source',
    ],
  ])('says %o as "%s" in names and the tooltip', (badge, words) => {
    renderPlainBoard(withBadge(badge));
    const { badge: link, cover } = badgeCell(new RegExp(`^${words}$`));
    expect(cover).toHaveAccessibleName(expect.stringContaining(`, ${words}`));
    focusElement(link);
    expect(tip()).toContain(words);
  });
});
