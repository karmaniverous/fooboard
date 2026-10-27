/**
 * Tests for a cell's tooltip as the pointer and focus move over the cell
 * as a whole (spec.md §3.10, §3.11, issue #42): its box, its
 * behind/diverged badge and the cell gear on it. Moving between them keeps
 * the tooltip; leaving them all closes it; another cell takes it at once.
 *
 * Each move fires what a browser fires, in its order: the pointer events,
 * then the mouse events, each naming where the pointer came from or went.
 *
 * @module
 */
import { act, fireEvent, screen, within } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';

import { measureBoard } from '@/demo/scenarios/measure';
import type { BoardModel } from '@/engine';
import { fullModel } from '@/test/boardModel';
import { shownCellGear } from '@/test/cellGear';
import { focusElement } from '@/test/focus';
import { renderSettingsBoard } from '@/test/settingsBoard';

let model: BoardModel;
beforeAll(async () => {
  model = await fullModel(measureBoard);
});

/** Move the mouse from `from` (null: from outside the window) to `to`. */
const move = (from: Element | null, to: Element) => {
  if (from)
    fireEvent.pointerOut(from, { pointerType: 'mouse', relatedTarget: to });
  fireEvent.pointerOver(to, { pointerType: 'mouse', relatedTarget: from });
  if (from) fireEvent.mouseOut(from, { relatedTarget: to });
  fireEvent.mouseOver(to, { relatedTarget: from });
};

/** The tooltip's text, or null when it is closed. */
const tip = () => screen.queryByRole('tooltip')?.textContent ?? null;

const gear = (): HTMLElement => {
  const g = shownCellGear();
  if (!g) throw new Error('no cell gear');
  return g;
};

/** Somewhere off every cell: a stage header. */
const header = (name: RegExp = /Bali/) =>
  screen.getByRole('columnheader', { name });

/** The billing row's behind badge, and its cell's cover link. */
const badgeCell = () => {
  const badge = screen.getAllByRole('link', { name: /^3 commits behind/ })[0];
  const cell = badge.closest('[role="gridcell"]');
  if (!(cell instanceof HTMLElement)) throw new Error('no badge cell');
  return { badge, cover: within(cell).getAllByRole('link')[0] };
};

const covers = () =>
  screen
    .getAllByRole('gridcell')
    .map((c) => within(c).queryAllByRole('link')[0])
    .filter(Boolean);

const empty = () => screen.getAllByRole('button', { name: /^no records/ })[0];

describe("a status cell's tooltip", () => {
  it('stays open from the cell onto its badge, and back', () => {
    renderSettingsBoard(measureBoard, model);
    const { badge, cover } = badgeCell();
    move(null, cover);
    const text = tip();
    expect(text).toMatch(/billing/);
    move(cover, badge);
    expect(tip()).toBe(text);
    move(badge, cover);
    expect(tip()).toBe(text);
    move(cover, header());
    expect(tip()).toBeNull();
  });

  it('closes when the pointer leaves the badge for outside the cell', () => {
    renderSettingsBoard(measureBoard, model);
    const { badge, cover } = badgeCell();
    move(null, cover);
    move(cover, badge);
    move(badge, header());
    expect(tip()).toBeNull();
  });

  it('stays open from the cell onto its gear and back, and closes off both', () => {
    renderSettingsBoard(measureBoard, model);
    const [cover] = covers();
    move(null, cover);
    const text = tip();
    expect(text).not.toBeNull();
    const g = gear();
    move(cover, g);
    expect(tip()).toBe(text);
    // Within the gear, from its icon to the button, it stays too.
    const icon = g.querySelector('svg');
    if (!icon) throw new Error('no icon');
    move(g, icon);
    move(icon, g);
    expect(tip()).toBe(text);
    move(g, cover);
    expect(tip()).toBe(text);
    move(cover, g);
    move(g, header());
    expect(tip()).toBeNull();
  });

  it('switches at once to another cell, from the cell or from its gear', () => {
    renderSettingsBoard(measureBoard, model);
    const [first, second, third] = covers();
    move(null, first);
    const one = tip();
    move(first, second);
    const two = tip();
    expect(two).not.toBeNull();
    expect(two).not.toBe(one);
    move(second, gear());
    move(gear(), third);
    expect(tip()).not.toBeNull();
    expect([one, two]).not.toContain(tip());
  });

  it('keeps a focused cell’s tooltip while the pointer moves off the cells', () => {
    renderSettingsBoard(measureBoard, model);
    const [cover] = covers();
    focusElement(cover);
    const text = tip();
    expect(text).not.toBeNull();
    move(header(), header(/Spokane/));
    expect(tip()).toBe(text);
  });

  it('keeps a focused cell’s tooltip while the pointer moves within another cell’s gear', () => {
    renderSettingsBoard(measureBoard, model);
    const [first, second] = covers();
    move(null, first);
    const g = gear();
    const icon = g.querySelector('svg');
    if (!icon) throw new Error('no icon');
    move(first, g);
    // A click's focus (not the keyboard's) leaves the gear on the first.
    focusElement(second);
    const text = tip();
    expect(text).toMatch(/Spokane/);
    move(g, icon);
    move(icon, g);
    expect(tip()).toBe(text);
  });

  it('is hidden while the gear’s settings popup is open', async () => {
    renderSettingsBoard(measureBoard, model);
    const [cover] = covers();
    move(null, cover);
    move(cover, gear());
    fireEvent.click(gear());
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    // The modal popup hides the rest of the page from role queries.
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  });
});

describe("an empty cell's tooltip", () => {
  it('stays open from the cell onto its gear and back, and closes off both', () => {
    renderSettingsBoard(measureBoard, model);
    const cell = empty();
    move(null, cell);
    const text = tip();
    expect(text).toMatch(/no records/);
    move(cell, gear());
    expect(tip()).toBe(text);
    move(gear(), cell);
    expect(tip()).toBe(text);
    move(cell, gear());
    move(gear(), header());
    expect(tip()).toBeNull();
    move(null, cell);
    move(cell, header());
    expect(tip()).toBeNull();
  });

  it('switches at once to another cell from its gear', () => {
    renderSettingsBoard(measureBoard, model);
    const cell = empty();
    move(null, cell);
    const text = tip();
    const [cover] = covers();
    move(cell, gear());
    move(gear(), cover);
    expect(tip()).not.toBeNull();
    expect(tip()).not.toBe(text);
  });
});

describe('focus over the cell as a whole', () => {
  it('keeps the tooltip as focus moves from the cover to the badge', () => {
    renderSettingsBoard(measureBoard, model);
    const { badge, cover } = badgeCell();
    focusElement(cover);
    const text = tip();
    expect(text).toMatch(/Press Space for details/);
    fireEvent.focusOut(cover, { relatedTarget: badge });
    expect(tip()).toBe(text);
    focusElement(badge);
    // Still the cell's tooltip; Space is the cover's key, not the badge's,
    // so only comma is named.
    expect(tip()).toMatch(/billing/);
    expect(tip()).not.toMatch(/Press Space/);
    expect(tip()).toMatch(/Press , \(comma\) for settings$/);
    focusElement(cover);
    expect(tip()).toBe(text);
  });

  it.each([
    ['a status cell', () => covers()[0]],
    ['an empty cell', empty],
  ])('keeps the tooltip as focus moves from %s to its gear', (_, cellOf) => {
    renderSettingsBoard(measureBoard, model);
    const cell = cellOf();
    move(null, cell);
    focusElement(cell);
    expect(tip()).toMatch(/Press Space for details/);
    focusElement(gear());
    expect(tip()).not.toBeNull();
    // Focus leaving the gear for outside the cell closes it.
    act(() => {
      gear().blur();
    });
    expect(tip()).toBeNull();
  });

  it('closes when focus moves from a cell to another cell’s gear', () => {
    renderSettingsBoard(measureBoard, model);
    const [first, second] = covers();
    // The pointer brings the gear to the first cell; a click's focus (not
    // the keyboard's) on the second leaves it there.
    move(null, first);
    focusElement(second);
    expect(gear()).toHaveAccessibleName(/Bali/);
    const text = tip();
    expect(text).toMatch(/Spokane/);
    focusElement(gear());
    expect(tip()).toBeNull();
  });
});
