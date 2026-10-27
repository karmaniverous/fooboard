/**
 * Tests for the marks that tie the cell gear to grid cells (spec.md §3.11,
 * issue #42): a node maps to the marked grid cell it is in, only a fully
 * marked one, and the gear names the cell it sits on by that cell's key.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import {
  gearOwnerOf,
  gearOwnerProps,
  gearTargetKey,
  gearTargetOf,
  gearTargetProps,
} from './cellGearTarget';

const marked = (attrs: Record<string, string>) => {
  const cell = document.createElement('div');
  for (const [k, v] of Object.entries(attrs)) cell.setAttribute(k, v);
  const inner = document.createElement('span');
  cell.append(inner);
  return { cell, inner };
};

describe('gearTargetOf', () => {
  it('maps a node to the marked grid cell it is in', () => {
    const { cell, inner } = marked(gearTargetProps('api', 'dev'));
    expect(gearTargetOf(inner)).toEqual({
      rowId: 'api',
      stageId: 'dev',
      el: cell,
    });
  });

  it('ignores a cell marked with a row but no stage, and non-elements', () => {
    const { inner } = marked({ 'data-gear-row': 'api' });
    expect(gearTargetOf(inner)).toBeNull();
    expect(gearTargetOf(null)).toBeNull();
    expect(gearTargetOf(window)).toBeNull();
  });
});

describe('gearOwnerOf', () => {
  it('reads the key of the cell a gear names, from the gear or its icon', () => {
    const { cell: gear, inner: icon } = marked(
      gearOwnerProps({ rowId: 'api', stageId: 'dev' }),
    );
    const key = gearTargetKey({ rowId: 'api', stageId: 'dev' });
    expect(gearOwnerOf(gear)).toBe(key);
    expect(gearOwnerOf(icon)).toBe(key);
    expect(gearOwnerOf(document.createElement('button'))).toBeUndefined();
  });
});
