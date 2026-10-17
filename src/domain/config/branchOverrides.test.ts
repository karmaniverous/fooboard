/**
 * Tests for effective branch patterns (spec.md C-14c): a row's override
 * beats its group's, which beats the stage's pattern.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { effectiveBranchPattern, effectiveStages } from './branchOverrides';

const release = { id: 'release', name: 'release', branchPattern: 'release/*' };
const dev = { id: 'dev', name: 'dev', branchPattern: 'dev' };
const group = {
  id: 'fe',
  memberIds: ['web'],
  branchPatternOverrides: { release: 'preview/release' },
  defaultCredentials: {},
};

describe('effectiveBranchPattern', () => {
  it('resolves row > row group > stage', () => {
    const plain = { id: 'api', branchPatternOverrides: {} };
    const web = { id: 'web', branchPatternOverrides: {} };
    const own = { id: 'web', branchPatternOverrides: { release: 'rc/*' } };
    expect(effectiveBranchPattern(release, plain, undefined)).toBe('release/*');
    expect(effectiveBranchPattern(release, web, group)).toBe('preview/release');
    expect(effectiveBranchPattern(release, own, group)).toBe('rc/*');
  });
});

describe('effectiveStages', () => {
  it('rewrites only overridden stages for the row', () => {
    const stages = [dev, release];
    const out = effectiveStages(
      { stages, rowGroups: [group] },
      { id: 'web', branchPatternOverrides: {} },
    );
    expect(out[0]).toBe(dev);
    expect(out[1]).toEqual({ ...release, branchPattern: 'preview/release' });
    expect(
      effectiveStages(
        { stages, rowGroups: [group] },
        { id: 'api', branchPatternOverrides: {} },
      ),
    ).toEqual(stages);
  });
});
