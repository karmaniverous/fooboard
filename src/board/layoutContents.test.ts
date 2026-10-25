/**
 * Tests for worst-case contents (spec.md C-13) on the demo board: headers
 * and group labels are included, fixed fields use their longest forms,
 * the badge moves after the commit from rung 3, and free text appears only
 * at rungs 4 and 5.
 *
 * @module
 */
import { beforeAll, describe, expect, it } from 'vitest';

import { measureBoard } from '@/demo/scenarios/measure';
import type { BoardModel } from '@/engine';
import { fullModel } from '@/test/boardModel';

import { boardContents } from './layoutContents';
import { HEADER_GEAR_EM } from './settingsGearSize';

let model: BoardModel;

beforeAll(async () => {
  model = await fullModel(measureBoard);
});

describe('boardContents', () => {
  it('includes headers and group labels, and grows with the rung', () => {
    const contents = boardContents(measureBoard, model, true);
    const leads = contents(1).map((c) => c.lead);
    for (const stage of measureBoard.stages)
      expect(leads).toContain(stage.name);
    const status = (rung: 0 | 1 | 2 | 3 | 4 | 5) =>
      contents(rung).find((c) => c.lead.startsWith('\u2298'));
    const keys = (rung: 0 | 1 | 2 | 3 | 4 | 5) =>
      status(rung)?.items.map((i) => i.key);
    expect(status(0)?.lead).toBe('\u2298');
    expect(keys(1)).toEqual([]);
    expect(keys(2)).toEqual(['time']);
    expect(keys(3)).toEqual(['time', 'commit']);
    // The badge moves from the lead to the commit at rung 3.
    expect(status(2)?.badge).toBeDefined();
    expect(status(3)?.badge).toBeUndefined();
    expect(status(3)?.items[1]?.badge).toBeDefined();
    const free = (rung: 3 | 4) =>
      contents(rung).some((c) => c.items.some((i) => i.free));
    expect(free(3)).toBe(false);
    expect(free(4)).toBe(true);
  });

  it('keeps room for the gear of every stage header and labelled group label, at every rung', () => {
    const contents = boardContents(measureBoard, model, true);
    for (const rung of [0, 3] as const) {
      const all = contents(rung);
      // Cells keep none: their gear is laid over a corner.
      const kept = all.filter((c) => c.trail !== undefined);
      expect(kept.every((c) => c.trail === HEADER_GEAR_EM)).toBe(true);
      expect(kept).toHaveLength(measureBoard.stages.length + 1);
      expect(all.find((c) => c.lead === 'Preview')).toMatchObject({
        span: 3,
        trail: HEADER_GEAR_EM,
      });
    }
    expect(
      contents(3)
        .filter((c) => c.trail)
        .map((c) => c.lead),
    ).toEqual(expect.arrayContaining(measureBoard.stages.map((s) => s.name)));
  });

  it('keeps no room for header gears on a narrow screen, where there are none', () => {
    const contents = boardContents(measureBoard, model, false);
    for (const rung of [0, 3] as const)
      expect(contents(rung).filter((c) => c.trail)).toEqual([]);
  });
});
