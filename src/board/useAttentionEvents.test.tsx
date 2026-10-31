/**
 * Tests for the board's attention events (spec 0.2.0 §3.H, Decisions 85
 * and 97): what boosts a row and what doesn't. A click on a cell, a row
 * header or a row group label boosts as a click; Space on a link cover
 * and Enter on a focused row header count once; opening a cell's, row's
 * or row group's settings boosts; the pointer or keyboard focus resting
 * on a cell for `DWELL_MS` boosts it once per entry. A middle click, a
 * stage header, a column group label, a column's settings, a pass
 * shorter than the dwell, touch and Enter on a header's gear boost
 * nothing by themselves.
 *
 * @module
 */
import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { measureBoard } from '@/demo/scenarios/measure';
import type { BoardModel } from '@/engine';
import { fullModel } from '@/test/boardModel';
import { focusElement } from '@/test/focus';
import { renderSettingsBoard } from '@/test/settingsBoard';

import { DWELL_MS } from './useAttentionEvents';

let model: BoardModel;
beforeAll(async () => {
  model = await fullModel(measureBoard);
});
afterEach(() => {
  vi.useRealTimers();
});

const gear = (name: string) =>
  screen.getByRole('button', { name, hidden: true });
const rowOf = (el: Element): string => {
  const id = el.closest<HTMLElement>('[data-gear-row]')?.dataset.gearRow;
  if (id === undefined) throw new Error('not in a cell');
  return id;
};
const cover = (tag: 'a' | 'button'): HTMLElement => {
  const el = document.querySelector<HTMLElement>(`${tag}[data-cell-control]`);
  if (!el) throw new Error(`no ${tag} cover`);
  return el;
};
const row = (rowId: string) => ({ level: 'row', rowId });
const click = (el: Element, button = 0) => {
  fireEvent.click(el, { button });
};

describe('attention events: clicks and keys', () => {
  it('boosts a clicked cell’s row as a click, a link cover’s and a button cover’s', () => {
    const { attend } = renderSettingsBoard(measureBoard, model);
    const link = cover('a');
    click(link);
    const button = cover('button');
    click(button);
    expect(attend.mock.calls).toEqual([
      [row(rowOf(link)), 'click'],
      [row(rowOf(button)), 'click'],
    ]);
  });

  it('boosts nothing for a middle or secondary click', () => {
    const { attend } = renderSettingsBoard(measureBoard, model);
    fireEvent(cover('a'), new MouseEvent('auxclick', { bubbles: true }));
    click(cover('a'), 1);
    click(cover('a'), 2);
    expect(attend).not.toHaveBeenCalled();
  });

  it('boosts a row header’s row, and a row group label’s rows', () => {
    const { attend } = renderSettingsBoard(measureBoard, model);
    click(screen.getByRole('rowheader', { name: /api-core/ }));
    click(screen.getByRole('rowheader', { name: /Backend/ }));
    expect(attend.mock.calls).toEqual([
      [row('api-core'), 'click'],
      [{ level: 'rowGroup', groupId: 'backend' }, 'click'],
    ]);
  });

  it('boosts nothing for a stage header or a column group label', () => {
    const { attend } = renderSettingsBoard(measureBoard, model);
    for (const header of screen.getAllByRole('columnheader')) click(header);
    expect(attend).not.toHaveBeenCalled();
  });

  it('counts Enter on a focused row header, not on its gear by itself', () => {
    const { attend } = renderSettingsBoard(measureBoard, model);
    const header = screen.getByRole('rowheader', { name: /api-core/ });
    fireEvent.keyDown(gear('Settings for row api-core'), { key: 'Enter' });
    expect(attend).not.toHaveBeenCalled();
    fireEvent.keyDown(header, { key: 'Enter' });
    expect(attend.mock.calls).toEqual([[row('api-core'), 'click']]);
  });

  it('counts Space once on a link cover and once on a button cover', () => {
    const { attend } = renderSettingsBoard(measureBoard, model);
    const link = cover('a');
    fireEvent.keyDown(link, { key: ' ' });
    // A button turns Space into a click; its keydown isn't counted.
    const button = cover('button');
    fireEvent.keyDown(button, { key: ' ' });
    fireEvent.keyUp(button, { key: ' ' });
    click(button);
    expect(attend.mock.calls).toEqual([
      [row(rowOf(link)), 'click'],
      [row(rowOf(button)), 'click'],
    ]);
  });

  it('boosts when a cell’s, row’s or row group’s settings open, not a column’s', () => {
    const { attend } = renderSettingsBoard(measureBoard, model);
    click(gear('Settings for stage Dev'));
    click(gear('Settings for column group Preview'));
    expect(attend).not.toHaveBeenCalled();
    click(gear('Settings for row api-core'));
    click(gear('Settings for row group Backend'));
    const link = cover('a');
    focusElement(link);
    fireEvent.keyDown(link, { key: ',' });
    expect(attend.mock.calls).toEqual([
      [row('api-core'), 'click'],
      [{ level: 'rowGroup', groupId: 'backend' }, 'click'],
      [row(rowOf(link)), 'click'],
    ]);
  });
});

describe('attention events: dwells', () => {
  /** Focus from the keyboard (not focus a click leaves behind). */
  const tabTo = (el: HTMLElement) => {
    fireEvent.keyDown(document.body, { key: 'Tab' });
    focusElement(el);
  };
  const pointer = (el: Element, pointerType = 'mouse') => {
    fireEvent.pointerOver(el, { pointerType });
  };
  const wait = (ms: number) => {
    act(() => {
      vi.advanceTimersByTime(ms);
    });
  };

  it('boosts a cell the mouse rests on, once per entry', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { attend } = renderSettingsBoard(measureBoard, model);
    const link = cover('a');
    pointer(link);
    wait(DWELL_MS - 1);
    expect(attend).not.toHaveBeenCalled();
    wait(1);
    pointer(link);
    wait(DWELL_MS * 2);
    expect(attend.mock.calls).toEqual([[row(rowOf(link)), 'dwell']]);
    // Leaving and coming back is a new entry.
    pointer(screen.getByRole('rowheader', { name: /api-core/ }));
    pointer(link);
    wait(DWELL_MS);
    expect(attend).toHaveBeenCalledTimes(2);
  });

  it('boosts nothing for a pass shorter than the dwell, or a touch', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { attend } = renderSettingsBoard(measureBoard, model);
    pointer(cover('a'));
    wait(DWELL_MS - 1);
    pointer(screen.getByRole('rowheader', { name: /api-core/ }));
    wait(DWELL_MS);
    pointer(cover('a'), 'touch');
    wait(DWELL_MS);
    expect(attend).not.toHaveBeenCalled();
  });

  it('keeps one dwell while the pointer moves between a cell and its gear', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { attend } = renderSettingsBoard(measureBoard, model);
    const link = cover('a');
    pointer(link);
    wait(DWELL_MS / 2);
    const cellGear = document.querySelector('[data-gear-of]');
    if (!cellGear) throw new Error('no cell gear');
    pointer(cellGear);
    wait(DWELL_MS / 2);
    expect(attend.mock.calls).toEqual([[row(rowOf(link)), 'dwell']]);
  });

  it('boosts a cell keyboard focus rests on, not one it leaves first', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { attend } = renderSettingsBoard(measureBoard, model);
    const header = screen.getByRole('rowheader', { name: /api-core/ });
    const link = cover('a');
    tabTo(link);
    wait(DWELL_MS - 1);
    tabTo(header);
    wait(DWELL_MS);
    expect(attend).not.toHaveBeenCalled();
    tabTo(link);
    wait(DWELL_MS);
    expect(attend.mock.calls).toEqual([[row(rowOf(link)), 'dwell']]);
  });

  it('boosts nothing for focus a click leaves behind', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { attend } = renderSettingsBoard(measureBoard, model);
    const link = cover('a');
    fireEvent.mouseDown(link);
    focusElement(link);
    wait(DWELL_MS);
    expect(attend).not.toHaveBeenCalled();
  });
});
