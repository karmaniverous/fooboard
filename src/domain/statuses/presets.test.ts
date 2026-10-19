/**
 * Tests for preset lookup (each preset's statuses are covered by the
 * parity fixtures in `domain/model`).
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { PRESETS } from './presets';
import { findStatusSet } from './resolve';

describe('findStatusSet', () => {
  it('finds presets first, then custom sets', () => {
    const preset = PRESETS.find((p) => p.id === 'amplify');
    if (!preset) throw new Error('no presets');
    const custom = { ...preset, id: 'mine' };
    expect(findStatusSet('mine', [custom])).toBe(custom);
    expect(findStatusSet(preset.id, [{ ...preset, name: 'shadow' }])).toBe(
      preset,
    );
    expect(findStatusSet('nope')).toBeUndefined();
  });
});
