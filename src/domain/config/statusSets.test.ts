/**
 * Tests for `StatusSetSchema`: a set must be internally consistent (unique
 * ids, cell statuses counting toward its own summary statuses) and can't
 * reuse Unknown's id.
 *
 * @module
 */
import { describe, expect, it } from 'vitest';

import { presetById } from '@/domain/statuses/presets';

import { PRESET_IDS, type StatusSet, StatusSetSchema } from './statusSets';

const base = presetById(PRESET_IDS.githubSingleJob);
const messages = (set: StatusSet) => {
  const parsed = StatusSetSchema.safeParse(set);
  return parsed.success ? [] : parsed.error.issues.map((i) => i.message);
};

describe('StatusSetSchema', () => {
  it('accepts a consistent set', () => {
    expect(messages(base)).toEqual([]);
  });

  it('rejects duplicate summary and cell status ids', () => {
    expect(
      messages({
        ...base,
        summary: [...base.summary, base.summary[0]],
        cell: [...base.cell, base.cell[0]],
      }),
    ).toEqual([
      `duplicate summary status id: ${base.summary[0].id}`,
      `duplicate cell status id: ${base.cell[0].id}`,
    ]);
  });

  it('rejects a cell status counting toward a summary status not in the set', () => {
    expect(
      messages({ ...base, cell: [{ ...base.cell[0], summary: 'nope' }] }),
    ).toEqual([
      `cell status ${base.cell[0].id} counts toward unknown summary status nope`,
    ]);
  });

  it("rejects Unknown's id", () => {
    expect(
      messages({ ...base, cell: [{ ...base.cell[0], id: 'unknown' }] }),
    ).toEqual(['"unknown" is reserved for the built-in status']);
  });
});
