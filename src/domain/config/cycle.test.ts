/**
 * Tests for source-stage cycle detection, used by the stage editor's source
 * picker (spec.md C-21).
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { findAnyCycle, findSourceCycle, wouldCreateCycle } from './cycle';

const chain = [
  { id: 's1', sourceStageId: undefined },
  { id: 's2', sourceStageId: 's1' },
  { id: 's3', sourceStageId: 's2' },
];

describe('findSourceCycle', () => {
  it('returns undefined for an acyclic chain', () => {
    expect(findSourceCycle(chain, 's3')).toBeUndefined();
  });

  it('finds a direct self-cycle', () => {
    const stages = [{ id: 's1', sourceStageId: 's1' }];
    expect(findSourceCycle(stages, 's1')).toEqual(['s1']);
  });

  it('finds a multi-stage cycle', () => {
    const stages = [
      { id: 's1', sourceStageId: 's2' },
      { id: 's2', sourceStageId: 's1' },
    ];
    expect(findSourceCycle(stages, 's1')).toEqual(['s1', 's2']);
  });
});

describe('wouldCreateCycle', () => {
  it('rejects setting a stage as its own source', () => {
    expect(wouldCreateCycle(chain, 's1', 's1')).toBe(true);
  });

  it('rejects a source choice that closes a loop', () => {
    expect(wouldCreateCycle(chain, 's1', 's3')).toBe(true);
  });

  it('accepts a source choice that stays acyclic', () => {
    const stages = [
      { id: 's1', sourceStageId: undefined },
      { id: 's2', sourceStageId: undefined },
    ];
    expect(wouldCreateCycle(stages, 's2', 's1')).toBe(false);
  });
});

describe('findAnyCycle', () => {
  it('returns undefined when no stage is in a cycle', () => {
    expect(findAnyCycle(chain)).toBeUndefined();
  });

  it('finds a cycle anywhere in the stage list', () => {
    const stages = [
      { id: 's1', sourceStageId: undefined },
      { id: 's2', sourceStageId: 's3' },
      { id: 's3', sourceStageId: 's2' },
    ];
    expect(findAnyCycle(stages)).toEqual(['s2', 's3']);
  });
});
