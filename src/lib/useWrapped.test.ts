/**
 * Tests for wrap detection: children on one line are not wrapped even when
 * their heights differ; a child starting below the first line is.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { hasWrapped } from './useWrapped';

const at = (top: number, height: number) => {
  const el = document.createElement('div');
  Object.defineProperty(el, 'offsetTop', { value: top });
  Object.defineProperty(el, 'offsetHeight', { value: height });
  return el;
};

describe('hasWrapped', () => {
  it('ignores height differences on one line and detects a second line', () => {
    expect(hasWrapped([at(4, 20), at(0, 28), at(6, 16)])).toBe(false);
    expect(hasWrapped([at(0, 28), at(32, 28)])).toBe(true);
    expect(hasWrapped([at(0, 28)])).toBe(false);
  });
});
