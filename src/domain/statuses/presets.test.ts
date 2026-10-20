/**
 * Tests for preset lookup by id (each preset's statuses are covered by the
 * parity fixtures in `domain/model`).
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { PRESET_IDS } from '@/domain/config/statusSets';

import { presetById, PRESETS } from './presets';
import { findStatusSet } from './resolve';

describe('findStatusSet', () => {
  it('finds presets first, then custom sets', () => {
    const preset = PRESETS.find((p) => p.id === PRESET_IDS.amplify);
    if (!preset) throw new Error('no presets');
    const custom = { ...preset, id: 'mine' };
    expect(findStatusSet('mine', [custom])).toBe(custom);
    expect(findStatusSet(preset.id, [{ ...preset, name: 'shadow' }])).toBe(
      preset,
    );
    expect(findStatusSet('nope')).toBeUndefined();
  });
});

describe('presetById', () => {
  it('finds a bundled preset and throws for an unknown id', () => {
    expect(presetById(PRESET_IDS.amplify).id).toBe(PRESET_IDS.amplify);
    expect(() => presetById('nope')).toThrow('no preset nope');
  });
});
