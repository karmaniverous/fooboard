/**
 * Tests for the cell as a whole (issue #42): what counts as within a cell
 * (its box, and the cell gear sitting on it, not another cell's), and
 * whether its control has focus.
 *
 * @module
 */
import { afterEach, describe, expect, it } from 'vitest';

import { CELL_CONTROL, controlHasFocus, withinCell } from './cellBox';
import { gearOwnerProps, gearTargetProps } from './cellGearTarget';

const el = (tag: string, attrs: Record<string, string> = {}) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};

/** A grid cell holding a box with a control and a badge, and a gear. */
const board = (marked = true) => {
  const grid = el('div', marked ? gearTargetProps('api', 'dev') : {});
  const box = el('div');
  const control = el('a', { href: '#', ...CELL_CONTROL });
  const badge = el('a', { href: '#' });
  box.append(control, badge);
  grid.append(box);
  const gear = el('button', gearOwnerProps({ rowId: 'api', stageId: 'dev' }));
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  gear.append(icon);
  document.body.append(grid, gear);
  return { box, control, badge, gear, icon };
};

afterEach(() => {
  document.body.replaceChildren();
});

describe('withinCell', () => {
  it('holds the box, its control and badge, and its own gear', () => {
    const { box, control, badge, gear, icon } = board();
    for (const node of [box, control, badge, gear, icon])
      expect(withinCell(box, node)).toBe(true);
  });

  it.each([
    ['another row', { rowId: 'web', stageId: 'dev' }],
    ['another stage', { rowId: 'api', stageId: 'prod' }],
  ])('holds no gear on %s', (_, owner) => {
    const { box, gear } = board();
    for (const [k, v] of Object.entries(gearOwnerProps(owner)))
      gear.setAttribute(k, v);
    expect(withinCell(box, gear)).toBe(false);
  });

  it('holds nothing else, and no gear on a cell the gear never marks', () => {
    const { box } = board();
    expect(withinCell(box, document.body)).toBe(false);
    expect(withinCell(box, null)).toBe(false);
    expect(withinCell(box, window)).toBe(false);
    document.body.replaceChildren();
    const unmarked = board(false);
    expect(withinCell(unmarked.box, unmarked.gear)).toBe(false);
  });
});

describe('controlHasFocus', () => {
  it('is true only while the cell’s own control has focus', () => {
    const { box, control, badge } = board();
    expect(controlHasFocus(box)).toBe(false);
    control.focus();
    expect(controlHasFocus(box)).toBe(true);
    badge.focus();
    expect(controlHasFocus(box)).toBe(false);
    const other = board();
    other.control.focus();
    expect(controlHasFocus(box)).toBe(false);
  });
});
